import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.post('/', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseCode, courseName, semester, academicYear } = await c.req.json()
  if (!courseCode || !courseName || !semester || !academicYear) {
    return c.json({ success: false, message: 'All course fields are required.' }, 400)
  }
  const db = getDb(c.env)
  const { data, error } = await db
    .from('courses')
    .insert({ course_code: courseCode, course_name: courseName, professor_id: c.get('user').id, semester, academic_year: academicYear })
    .select()
    .single()
  if (error?.code === '23505') return c.json({ success: false, message: 'Course code already exists.' }, 409)
  if (error) throw error
  return c.json({ success: true, message: 'Course created successfully.', data: { course: data } }, 201)
})

router.delete('/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const db = getDb(c.env)
  const { data, error } = await db
    .from('courses')
    .delete()
    .eq('id', c.req.param('courseId'))
    .eq('professor_id', c.get('user').id)
    .select()
    .single()
  if (!data) return c.json({ success: false, message: 'المادة غير موجودة أو ليس لديك صلاحية لحذفها.' }, 404)
  return c.json({ success: true, message: 'تم حذف المادة وجميع البيانات المرتبطة بها بنجاح.' })
})

router.get('/my-courses', authMiddleware(), checkRole('student'), async (c) => {
  const db = getDb(c.env)
  const { data, error } = await db.rpc('rpc_get_student_courses', { p_student_id: c.get('user').id })
  if (error) throw error
  const courses = (data || []).map(c => ({
    ...c,
    attendance_percentage: c.total_sessions > 0
      ? Math.round((c.attended_sessions / c.total_sessions) * 100)
      : 0,
  }))
  return c.json({ success: true, courses })
})

router.get('/', authMiddleware(), async (c) => {
  const user = c.get('user')
  const db = getDb(c.env)
  if (user.role === 'professor') {
    const { data, error } = await db.rpc('rpc_get_professor_courses', { p_professor_id: user.id })
    if (error) throw error
    return c.json({ success: true, data: { courses: data || [] } })
  }
  if (user.role === 'student') {
    const { data, error } = await db.rpc('rpc_get_student_courses', { p_student_id: user.id })
    if (error) throw error
    return c.json({ success: true, data: { courses: data || [] } })
  }
  return c.json({ success: false, message: 'Access denied.' }, 403)
})

router.get('/:courseId', authMiddleware(), async (c) => {
  const courseId = c.req.param('courseId')
  const user = c.get('user')
  const db = getDb(c.env)

  const { data: course } = await db
    .from('courses')
    .select('*, users!courses_professor_id_fkey(full_name)')
    .eq('id', courseId)
    .single()
  if (!course) return c.json({ success: false, message: 'Course not found.' }, 404)
  course.professor_name = course.users?.full_name
  delete course.users

  if (user.role === 'professor' && course.professor_id !== user.id) {
    return c.json({ success: false, message: 'Access denied.' }, 403)
  }
  if (user.role === 'student') {
    const { data: enroll } = await db
      .from('enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', user.id)
      .single()
    if (!enroll) return c.json({ success: false, message: 'You are not enrolled in this course.' }, 403)
  }

  const { count } = await db.from('enrollments').select('*', { count: 'exact', head: true }).eq('course_id', courseId)
  course.enrolled_students = count || 0
  return c.json({ success: true, data: { course } })
})

router.post('/:courseId/enroll', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const { studentIds } = await c.req.json()
  const db = getDb(c.env)

  const { data: courseCheck } = await db.from('courses').select('id').eq('id', courseId).eq('professor_id', c.get('user').id).single()
  if (!courseCheck) return c.json({ success: false, message: 'Access denied.' }, 403)

  const rows = studentIds.map(sid => ({ course_id: courseId, student_id: sid }))
  const { data, error } = await db.from('enrollments').upsert(rows, { onConflict: 'course_id,student_id', ignoreDuplicates: true }).select()
  if (error) throw error
  return c.json({ success: true, message: `${(data || []).length} student(s) enrolled.`, data: { enrollments: data || [] } })
})

router.get('/:courseId/students', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const db = getDb(c.env)

  const { data: courseCheck } = await db.from('courses').select('id').eq('id', courseId).eq('professor_id', c.get('user').id).single()
  if (!courseCheck) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { data, error } = await db.rpc('rpc_get_course_students', { p_course_id: Number(courseId) })
  if (error) throw error
  const students = (data || []).map(s => ({
    ...s,
    attendance_percentage: s.total_sessions > 0 ? Math.round((s.attended_sessions / s.total_sessions) * 100) : 0,
    is_at_risk: s.total_sessions > 0 && s.attended_sessions / s.total_sessions < 0.25,
  }))
  return c.json({ success: true, data: { students } })
})

export default router
