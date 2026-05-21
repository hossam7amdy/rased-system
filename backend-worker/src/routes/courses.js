import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.post('/', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseCode, courseName, semester, academicYear } = await c.req.json()
  if (!courseCode || !courseName || !semester || !academicYear) {
    return c.json({ success: false, message: 'All course fields are required.' }, 400)
  }
  const sql = getDb(c.env)
  try {
    const result = await sql`
      INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
      VALUES (${courseCode}, ${courseName}, ${c.get('user').id}, ${semester}, ${academicYear})
      RETURNING *
    `
    return c.json({ success: true, message: 'Course created successfully.', data: { course: result[0] } }, 201)
  } catch (err) {
    if (err.code === '23505') return c.json({ success: false, message: 'Course code already exists.' }, 409)
    throw err
  }
})

router.delete('/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const sql = getDb(c.env)
  const result = await sql`
    DELETE FROM courses WHERE id = ${c.req.param('courseId')} AND professor_id = ${c.get('user').id}
    RETURNING *
  `
  if (result.length === 0) {
    return c.json({ success: false, message: 'المادة غير موجودة أو ليس لديك صلاحية لحذفها.' }, 404)
  }
  return c.json({ success: true, message: 'تم حذف المادة وجميع البيانات المرتبطة بها بنجاح.' })
})

router.get('/my-courses', authMiddleware(), checkRole('student'), async (c) => {
  const sql = getDb(c.env)
  const studentId = c.get('user').id
  const result = await sql`
    SELECT c.id, c.course_name, c.course_code, u.full_name as professor_name,
           COUNT(DISTINCT s.id) as total_sessions,
           COUNT(DISTINCT ar.id) as attended_sessions
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.professor_id = u.id
    LEFT JOIN attendance_sessions s ON c.id = s.course_id
    LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = ${studentId}
    WHERE e.student_id = ${studentId}
    GROUP BY c.id, u.full_name, e.enrolled_at
    ORDER BY e.enrolled_at DESC
  `
  const courses = result.map(course => ({
    ...course,
    attendance_percentage: course.total_sessions > 0
      ? Math.round((course.attended_sessions / course.total_sessions) * 100)
      : 0,
  }))
  return c.json({ success: true, courses })
})

router.get('/', authMiddleware(), async (c) => {
  const user = c.get('user')
  const sql = getDb(c.env)
  if (user.role === 'professor') {
    const result = await sql`
      SELECT c.*,
             COUNT(DISTINCT e.student_id) as student_count,
             COUNT(DISTINCT s.id) as session_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN attendance_sessions s ON c.id = s.course_id
      WHERE c.professor_id = ${user.id}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `
    return c.json({ success: true, data: { courses: result } })
  }
  if (user.role === 'student') {
    const result = await sql`
      SELECT c.id, c.course_name, c.course_code, u.full_name as professor_name,
             COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT ar.id) as attended_sessions
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.professor_id = u.id
      LEFT JOIN attendance_sessions s ON c.id = s.course_id
      LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = ${user.id}
      WHERE e.student_id = ${user.id}
      GROUP BY c.id, u.full_name, e.enrolled_at
      ORDER BY e.enrolled_at DESC
    `
    return c.json({ success: true, data: { courses: result } })
  }
  return c.json({ success: false, message: 'Access denied.' }, 403)
})

router.get('/:courseId', authMiddleware(), async (c) => {
  const courseId = c.req.param('courseId')
  const user = c.get('user')
  const sql = getDb(c.env)

  const courseResult = await sql`
    SELECT c.*, u.full_name as professor_name
    FROM courses c
    JOIN users u ON c.professor_id = u.id
    WHERE c.id = ${courseId}
  `
  if (courseResult.length === 0) return c.json({ success: false, message: 'Course not found.' }, 404)
  const course = courseResult[0]

  if (user.role === 'professor' && course.professor_id !== user.id) {
    return c.json({ success: false, message: 'Access denied.' }, 403)
  }
  if (user.role === 'student') {
    const enroll = await sql`
      SELECT id FROM enrollments WHERE course_id = ${courseId} AND student_id = ${user.id}
    `
    if (enroll.length === 0) return c.json({ success: false, message: 'You are not enrolled in this course.' }, 403)
  }

  const countResult = await sql`SELECT COUNT(*) as count FROM enrollments WHERE course_id = ${courseId}`
  course.enrolled_students = parseInt(countResult[0].count)
  return c.json({ success: true, data: { course } })
})

router.post('/:courseId/enroll', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const { studentIds } = await c.req.json()
  const sql = getDb(c.env)

  const courseCheck = await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND professor_id = ${c.get('user').id}
  `
  if (courseCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const enrollments = []
  for (const studentId of studentIds) {
    const result = await sql`
      INSERT INTO enrollments (course_id, student_id)
      VALUES (${courseId}, ${studentId})
      ON CONFLICT (course_id, student_id) DO NOTHING
      RETURNING *
    `
    if (result.length > 0) enrollments.push(result[0])
  }
  return c.json({ success: true, message: `${enrollments.length} student(s) enrolled.`, data: { enrollments } })
})

router.get('/:courseId/students', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const sql = getDb(c.env)

  const courseCheck = await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND professor_id = ${c.get('user').id}
  `
  if (courseCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const result = await sql`
    SELECT u.id, u.full_name, u.student_id, u.email,
           e.enrolled_at,
           COUNT(DISTINCT s.id) as total_sessions,
           COUNT(DISTINCT ar.id) as attended_sessions
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
    LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
    WHERE e.course_id = ${courseId}
    GROUP BY u.id, e.enrolled_at
    ORDER BY u.full_name
  `
  const students = result.map(s => ({
    ...s,
    attendance_percentage: s.total_sessions > 0
      ? Math.round((s.attended_sessions / s.total_sessions) * 100)
      : 0,
    is_at_risk: s.total_sessions > 0 && s.attended_sessions / s.total_sessions < 0.25,
  }))
  return c.json({ success: true, data: { students } })
})

export default router
