import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.get('/users', authMiddleware(), checkRole('admin'), async (c) => {
  const sql = getDb(c.env)
  const result = await sql`
    SELECT id, email, role, full_name, student_id, created_at
    FROM users ORDER BY created_at DESC
  `
  return c.json({ success: true, data: { users: result } })
})

router.get('/students', authMiddleware(), checkRole('admin'), async (c) => {
  const q = c.req.query('q') || ''
  const search = `%${q.trim().toLowerCase()}%`
  const sql = getDb(c.env)
  const result = await sql`
    SELECT id, full_name, student_id, email, created_at
    FROM users
    WHERE role = 'student'
      AND (${q} = '' OR LOWER(full_name) LIKE ${search} OR LOWER(student_id) LIKE ${search} OR LOWER(email) LIKE ${search})
    ORDER BY full_name ASC
    LIMIT 500
  `
  return c.json({ success: true, data: { students: result } })
})

router.get('/courses', authMiddleware(), checkRole('admin'), async (c) => {
  const q = c.req.query('q') || ''
  const search = `%${q.trim().toLowerCase()}%`
  const sql = getDb(c.env)
  const result = await sql`
    SELECT c.id, c.course_code, c.course_name, c.semester, c.academic_year, c.created_at,
           u.full_name AS professor_name
    FROM courses c
    JOIN users u ON c.professor_id = u.id
    WHERE ${q} = '' OR LOWER(c.course_name) LIKE ${search} OR LOWER(c.course_code) LIKE ${search} OR LOWER(u.full_name) LIKE ${search}
    ORDER BY c.created_at DESC
    LIMIT 500
  `
  return c.json({ success: true, data: { courses: result } })
})

router.post('/enroll', authMiddleware(), checkRole('admin'), async (c) => {
  const { studentId, courseId } = await c.req.json()
  if (!studentId || !courseId) {
    return c.json({ success: false, message: 'يجب اختيار الطالب والكورس.' }, 400)
  }
  const sql = getDb(c.env)
  const result = await sql`
    INSERT INTO enrollments (course_id, student_id)
    VALUES (${courseId}, ${studentId})
    ON CONFLICT (course_id, student_id) DO NOTHING
    RETURNING *
  `
  if (result.length === 0) {
    return c.json({ success: false, message: 'هذا الطالب مسجل بالفعل في هذا الكورس.' }, 409)
  }
  return c.json({ success: true, message: 'تم ربط الطالب بالكورس بنجاح.', data: { enrollment: result[0] } }, 201)
})

router.post('/enroll-bulk', authMiddleware(), checkRole('admin'), async (c) => {
  const { studentIds, courseIds } = await c.req.json()
  if (!Array.isArray(studentIds) || !studentIds.length || !Array.isArray(courseIds) || !courseIds.length) {
    return c.json({ success: false, message: 'يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.' }, 400)
  }
  if (studentIds.length * courseIds.length > 2000) {
    return c.json({ success: false, message: 'عدد التسجيلات كبير جداً. يُرجى تقسيمها على دفعات.' }, 400)
  }
  const sql = getDb(c.env)
  let enrolled = 0, duplicates = 0, errors = 0

  await sql.begin(async sql => {
    for (const studentId of studentIds) {
      for (const courseId of courseIds) {
        try {
          const result = await sql`
            INSERT INTO enrollments (course_id, student_id)
            VALUES (${courseId}, ${studentId})
            ON CONFLICT (course_id, student_id) DO NOTHING
            RETURNING id
          `
          result.length > 0 ? enrolled++ : duplicates++
        } catch {
          errors++
        }
      }
    }
  })

  return c.json({ success: true, message: `تمّ الربط: ${enrolled} جديد، ${duplicates} مكرر، ${errors} خطأ.`, enrolled, duplicates, errors }, 201)
})

router.post('/enroll-import', authMiddleware(), checkRole('admin'), async (c) => {
  const { rows } = await c.req.json()
  if (!Array.isArray(rows) || !rows.length) {
    return c.json({ success: false, message: 'لا توجد بيانات للاستيراد.' }, 400)
  }
  if (rows.length > 5000) {
    return c.json({ success: false, message: 'الحد الأقصى للاستيراد هو 5000 صف.' }, 400)
  }
  const sql = getDb(c.env)

  const [studentsRes, coursesRes] = await Promise.all([
    sql`SELECT id, student_id, full_name FROM users WHERE role = 'student'`,
    sql`SELECT id, course_code, course_name FROM courses`,
  ])

  const studentByUnivId = new Map(studentsRes.map(s => [s.student_id?.trim().toLowerCase(), s.id]))
  const studentByName   = new Map(studentsRes.map(s => [s.full_name?.trim().toLowerCase(), s.id]))
  const courseByCode    = new Map(coursesRes.map(c => [c.course_code?.trim().toLowerCase(), c.id]))
  const courseByName    = new Map(coursesRes.map(c => [c.course_name?.trim().toLowerCase(), c.id]))

  const toInsert = []
  const details  = []

  for (const row of rows) {
    const { rowNum, studentId: rawSid, studentName, courseCode: rawCode, courseName } = row
    const studentDbId = studentByUnivId.get(rawSid?.trim().toLowerCase()) ?? studentByName.get(studentName?.trim().toLowerCase())
    const courseDbId  = courseByCode.get(rawCode?.trim().toLowerCase())   ?? courseByName.get(courseName?.trim().toLowerCase())
    const detail = { rowNum, studentName: studentName || rawSid || '', studentId: rawSid || '', courseCode: rawCode || courseName || '', status: '', message: '' }

    if (!studentDbId && !courseDbId) { detail.status = 'error'; detail.message = 'الطالب والمادة غير موجودَيْن'; details.push(detail); continue }
    if (!studentDbId) { detail.status = 'error'; detail.message = `الطالب غير موجود: ${rawSid || studentName}`; details.push(detail); continue }
    if (!courseDbId)  { detail.status = 'error'; detail.message = `المادة غير موجودة: ${rawCode || courseName}`; details.push(detail); continue }
    toInsert.push({ courseId: courseDbId, studentId: studentDbId, detail })
  }

  let enrolled = 0, duplicates = 0, errors = 0

  await sql.begin(async sql => {
    for (const { courseId, studentId, detail } of toInsert) {
      try {
        const result = await sql`
          INSERT INTO enrollments (course_id, student_id)
          VALUES (${courseId}, ${studentId})
          ON CONFLICT (course_id, student_id) DO NOTHING
          RETURNING id
        `
        if (result.length > 0) { enrolled++; detail.status = 'enrolled'; detail.message = 'تم التسجيل' }
        else { duplicates++; detail.status = 'duplicate'; detail.message = 'مسجّل مسبقاً' }
      } catch (err) {
        errors++; detail.status = 'error'; detail.message = err.message
      }
      details.push(detail)
    }
  })

  return c.json({ success: true, message: `الاستيراد اكتمل: ${enrolled} جديد، ${duplicates} مكرر، ${errors} خطأ.`, total: rows.length, enrolled, duplicates, errors, details }, 201)
})

export default router
