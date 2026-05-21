import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.get('/users', authMiddleware(), checkRole('admin'), async (c) => {
  const db = getDb(c.env)
  const { data } = await db.from('users').select('id, email, role, full_name, student_id, created_at').order('created_at', { ascending: false })
  return c.json({ success: true, data: { users: data || [] } })
})

router.get('/students', authMiddleware(), checkRole('admin'), async (c) => {
  const q = c.req.query('q') || ''
  const db = getDb(c.env)
  let query = db.from('users').select('id, full_name, student_id, email, created_at').eq('role', 'student').order('full_name').limit(500)
  if (q) query = query.or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%,email.ilike.%${q}%`)
  const { data } = await query
  return c.json({ success: true, data: { students: data || [] } })
})

router.get('/courses', authMiddleware(), checkRole('admin'), async (c) => {
  const q = c.req.query('q') || ''
  const db = getDb(c.env)
  let query = db.from('courses').select('id, course_code, course_name, semester, academic_year, created_at, users!courses_professor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(500)
  if (q) query = query.or(`course_name.ilike.%${q}%,course_code.ilike.%${q}%`)
  const { data } = await query
  const courses = (data || []).map(c => ({ ...c, professor_name: c.users?.full_name, users: undefined }))
  return c.json({ success: true, data: { courses } })
})

router.post('/enroll', authMiddleware(), checkRole('admin'), async (c) => {
  const { studentId, courseId } = await c.req.json()
  if (!studentId || !courseId) return c.json({ success: false, message: 'يجب اختيار الطالب والكورس.' }, 400)
  const db = getDb(c.env)
  const { data, error } = await db.from('enrollments').upsert({ course_id: courseId, student_id: studentId }, { onConflict: 'course_id,student_id', ignoreDuplicates: true }).select().single()
  if (!data) return c.json({ success: false, message: 'هذا الطالب مسجل بالفعل في هذا الكورس.' }, 409)
  return c.json({ success: true, message: 'تم ربط الطالب بالكورس بنجاح.', data: { enrollment: data } }, 201)
})

router.post('/enroll-bulk', authMiddleware(), checkRole('admin'), async (c) => {
  const { studentIds, courseIds } = await c.req.json()
  if (!Array.isArray(studentIds) || !studentIds.length || !Array.isArray(courseIds) || !courseIds.length) {
    return c.json({ success: false, message: 'يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.' }, 400)
  }
  if (studentIds.length * courseIds.length > 2000) {
    return c.json({ success: false, message: 'عدد التسجيلات كبير جداً. يُرجى تقسيمها على دفعات.' }, 400)
  }
  const db = getDb(c.env)
  const rows = []
  for (const sid of studentIds) for (const cid of courseIds) rows.push({ course_id: cid, student_id: sid })

  const { data, error } = await db.from('enrollments').upsert(rows, { onConflict: 'course_id,student_id', ignoreDuplicates: true }).select()
  const enrolled = (data || []).length
  const duplicates = rows.length - enrolled
  return c.json({ success: true, message: `تمّ الربط: ${enrolled} جديد، ${duplicates} مكرر.`, enrolled, duplicates, errors: 0 }, 201)
})

router.post('/enroll-import', authMiddleware(), checkRole('admin'), async (c) => {
  const { rows } = await c.req.json()
  if (!Array.isArray(rows) || !rows.length) return c.json({ success: false, message: 'لا توجد بيانات للاستيراد.' }, 400)
  if (rows.length > 5000) return c.json({ success: false, message: 'الحد الأقصى للاستيراد هو 5000 صف.' }, 400)

  const db = getDb(c.env)
  const [{ data: students }, { data: courses }] = await Promise.all([
    db.from('users').select('id, student_id, full_name').eq('role', 'student'),
    db.from('courses').select('id, course_code, course_name'),
  ])

  const studentByUnivId = new Map((students || []).map(s => [s.student_id?.trim().toLowerCase(), s.id]))
  const studentByName   = new Map((students || []).map(s => [s.full_name?.trim().toLowerCase(), s.id]))
  const courseByCode    = new Map((courses  || []).map(c => [c.course_code?.trim().toLowerCase(), c.id]))
  const courseByName    = new Map((courses  || []).map(c => [c.course_name?.trim().toLowerCase(), c.id]))

  const toInsert = [], details = []
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

  let enrolled = 0, duplicates = 0
  if (toInsert.length > 0) {
    const insertRows = toInsert.map(r => ({ course_id: r.courseId, student_id: r.studentId }))
    const { data: inserted } = await db.from('enrollments').upsert(insertRows, { onConflict: 'course_id,student_id', ignoreDuplicates: true }).select()
    enrolled = (inserted || []).length
    duplicates = toInsert.length - enrolled
    for (const item of toInsert) {
      item.detail.status = 'enrolled'; item.detail.message = 'تم التسجيل'
      details.push(item.detail)
    }
  }

  return c.json({ success: true, message: `الاستيراد اكتمل: ${enrolled} جديد، ${duplicates} مكرر.`, total: rows.length, enrolled, duplicates, errors: details.filter(d => d.status === 'error').length, details }, 201)
})

export default router
