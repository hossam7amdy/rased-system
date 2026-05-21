import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'
import { getCurrentToken, generateAndStore, validateToken, stopSession } from '../qr.js'

const router = new Hono()

router.post('/sessions', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseId, sessionName, sessionDate } = await c.req.json()
  const db = getDb(c.env)
  const professorId = c.get('user').id

  const { data: courseCheck } = await db.from('courses').select('id').eq('id', courseId).eq('professor_id', professorId).single()
  if (!courseCheck) return c.json({ success: false, message: 'غير مسموح لك بإنشاء جلسة لهذه المادة.' }, 403)

  await db.from('attendance_sessions').update({ is_active: false }).eq('course_id', courseId).eq('is_active', true)

  const finalDate = sessionDate || new Date().toISOString().split('T')[0]
  const { data: session, error } = await db
    .from('attendance_sessions')
    .insert({ course_id: courseId, session_name: sessionName || 'محاضرة جديدة', session_date: finalDate, start_time: new Date().toISOString(), is_active: true })
    .select()
    .single()
  if (error) throw error

  const { token } = await generateAndStore(courseId, db)
  return c.json({ success: true, message: 'تم بدء جلسة التحضير بنجاح.', data: { session, token } }, 201)
})

router.patch('/sessions/:sessionId/end', authMiddleware(), checkRole('professor'), async (c) => {
  const sessionId = c.req.param('sessionId')
  const db = getDb(c.env)

  const { data: sessionCheck } = await db
    .from('attendance_sessions')
    .select('id, course_id, courses!inner(professor_id)')
    .eq('id', sessionId)
    .eq('courses.professor_id', c.get('user').id)
    .single()
  if (!sessionCheck) return c.json({ success: false, message: 'Access denied.' }, 403)

  await stopSession(sessionCheck.course_id, db)
  await db.from('attendance_sessions').update({ is_active: false, end_time: new Date().toISOString() }).eq('id', sessionId)
  return c.json({ success: true, message: 'Session ended successfully.' })
})

router.get('/current-qr/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const db = getDb(c.env)

  const { data: courseCheck } = await db.from('courses').select('id').eq('id', courseId).eq('professor_id', c.get('user').id).single()
  if (!courseCheck) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { token, remainingSeconds } = await getCurrentToken(courseId, db)
  return c.json({ success: true, data: { token, remainingSeconds } })
})

router.post('/scan', authMiddleware(), checkRole('student'), async (c) => {
  const { token } = await c.req.json()
  const studentId = c.get('user').id
  const db = getDb(c.env)

  const validation = await validateToken(token, db)
  if (!validation.valid) return c.json({ success: false, message: validation.message }, 400)

  const courseId = validation.courseId

  const { data: enrollCheck } = await db.from('enrollments').select('id').eq('student_id', studentId).eq('course_id', courseId).single()
  if (!enrollCheck) return c.json({ success: false, message: 'عذراً، أنت غير مسجل في هذه المادة.' }, 403)

  const { data: activeSession } = await db.from('attendance_sessions').select('id').eq('course_id', courseId).eq('is_active', true).single()
  if (!activeSession) return c.json({ success: false, message: 'لا توجد جلسة نشطة لهذه المادة حالياً.' }, 400)

  const sessionId = activeSession.id
  const { data: duplicate } = await db.from('attendance_records').select('id').eq('student_id', studentId).eq('session_id', sessionId).single()
  if (duplicate) return c.json({ success: false, message: 'تم تسجيل حضورك في هذه المحاضرة مسبقاً.' }, 409)

  const { error: insertErr } = await db.from('attendance_records').insert({
    session_id: sessionId, course_id: courseId, student_id: studentId,
    scanned_at: new Date().toISOString(), status: 'present',
  })
  if (insertErr) throw insertErr

  const { data: stats } = await db.rpc('rpc_student_course_stats', { p_student_id: studentId, p_course_id: courseId })
  const s = stats?.[0] || { total_sessions: 0, attended_sessions: 0 }
  const percentage = s.total_sessions > 0 ? Math.round((s.attended_sessions / s.total_sessions) * 100) : 0

  return c.json({ success: true, message: 'تم تسجيل الحضور بنجاح! ✅', data: { sessionId, courseId, attendancePercentage: percentage } })
})

router.get('/active-sessions', authMiddleware(), checkRole('student'), async (c) => {
  const db = getDb(c.env)
  const { data } = await db
    .from('attendance_sessions')
    .select('id, session_name, session_date, courses!inner(course_name, course_code, enrollments!inner(student_id))')
    .eq('is_active', true)
    .eq('courses.enrollments.student_id', c.get('user').id)
  return c.json({ success: true, data: data || [] })
})

router.get('/sessions/:sessionId', authMiddleware(), async (c) => {
  const db = getDb(c.env)
  const { data, error } = await db.rpc('rpc_get_session_attendance', { p_session_id: Number(c.req.param('sessionId')) })
  if (error) throw error
  const records = (data || []).map(r => ({
    ...r,
    attendance_percentage: r.total_sessions > 0 ? Math.round((r.total_attended / r.total_sessions) * 100) : 0,
  }))
  return c.json({ success: true, data: { records } })
})

router.get('/student', authMiddleware(), checkRole('student'), async (c) => {
  const db = getDb(c.env)
  const { data } = await db
    .from('attendance_records')
    .select('*, attendance_sessions(session_name, session_date, courses(course_name, course_code))')
    .eq('student_id', c.get('user').id)
    .order('scanned_at', { ascending: false })
  return c.json({ success: true, data: { attendance: data || [] } })
})

router.post('/manual-override', authMiddleware(), checkRole('professor'), async (c) => {
  const { sessionId, studentId, reason } = await c.req.json()
  const db = getDb(c.env)

  const { data: sessionCheck } = await db
    .from('attendance_sessions')
    .select('id, course_id, courses!inner(professor_id)')
    .eq('id', sessionId)
    .eq('courses.professor_id', c.get('user').id)
    .single()
  if (!sessionCheck) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { data: existing } = await db.from('attendance_records').select('id').eq('session_id', sessionId).eq('student_id', studentId).single()
  if (existing) return c.json({ success: false, message: 'Student already attended.' }, 409)

  const { data, error } = await db
    .from('attendance_records')
    .insert({ session_id: sessionId, course_id: sessionCheck.course_id, student_id: studentId, is_manual_override: true, override_reason: reason || 'Manual override', scanned_at: new Date().toISOString(), status: 'present' })
    .select()
    .single()
  if (error) throw error
  return c.json({ success: true, message: 'Manual attendance recorded.', data: { record: data } })
})

export default router
