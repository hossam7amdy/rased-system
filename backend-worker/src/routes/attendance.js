import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'
import { getCurrentToken, generateAndStore, validateToken, stopSession } from '../qr.js'

const router = new Hono()

// POST /api/attendance/sessions — professor starts session + initial QR
router.post('/sessions', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseId, sessionName, sessionDate } = await c.req.json()
  const sql = getDb(c.env)
  const professorId = c.get('user').id

  const courseCheck = await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND professor_id = ${professorId}
  `
  if (courseCheck.length === 0) {
    return c.json({ success: false, message: 'غير مسموح لك بإنشاء جلسة لهذه المادة.' }, 403)
  }

  await sql`
    UPDATE attendance_sessions SET is_active = false
    WHERE course_id = ${courseId} AND is_active = true
  `

  const finalDate = sessionDate || new Date().toISOString().split('T')[0]
  const result = await sql`
    INSERT INTO attendance_sessions (course_id, session_name, session_date, start_time, is_active)
    VALUES (${courseId}, ${sessionName || 'محاضرة جديدة'}, ${finalDate}, NOW(), true)
    RETURNING *
  `
  const session = result[0]

  // Generate initial QR token stored in DB
  const { token } = await generateAndStore(courseId, sql)

  return c.json({
    success: true,
    message: 'تم بدء جلسة التحضير بنجاح.',
    data: { session, token },
  }, 201)
})

// PATCH /api/attendance/sessions/:sessionId/end — professor ends session
router.patch('/sessions/:sessionId/end', authMiddleware(), checkRole('professor'), async (c) => {
  const sessionId = c.req.param('sessionId')
  const sql = getDb(c.env)

  const sessionCheck = await sql`
    SELECT s.id, s.course_id FROM attendance_sessions s
    JOIN courses c ON s.course_id = c.id
    WHERE s.id = ${sessionId} AND c.professor_id = ${c.get('user').id}
  `
  if (sessionCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const courseId = sessionCheck[0].course_id
  await stopSession(courseId, sql)

  await sql`
    UPDATE attendance_sessions SET is_active = false, end_time = NOW()
    WHERE id = ${sessionId}
  `
  return c.json({ success: true, message: 'Session ended successfully.' })
})

// GET /api/attendance/current-qr/:courseId — professor polls for current QR (replaces socket push)
router.get('/current-qr/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const sql = getDb(c.env)

  const courseCheck = await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND professor_id = ${c.get('user').id}
  `
  if (courseCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { token, remainingSeconds } = await getCurrentToken(courseId, sql)
  return c.json({ success: true, data: { token, remainingSeconds } })
})

// POST /api/attendance/scan — student scans QR
router.post('/scan', authMiddleware(), checkRole('student'), async (c) => {
  const { token, courseId: _ignored } = await c.req.json()
  const studentId = c.get('user').id
  const sql = getDb(c.env)

  const validation = await validateToken(token, sql)
  if (!validation.valid) {
    return c.json({ success: false, message: validation.message }, 400)
  }

  const courseId = validation.courseId

  const enrollCheck = await sql`
    SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
  `
  if (enrollCheck.length === 0) {
    return c.json({ success: false, message: 'عذراً، أنت غير مسجل في هذه المادة.' }, 403)
  }

  const activeSession = await sql`
    SELECT id FROM attendance_sessions WHERE course_id = ${courseId} AND is_active = true LIMIT 1
  `
  if (activeSession.length === 0) {
    return c.json({ success: false, message: 'لا توجد جلسة نشطة لهذه المادة حالياً.' }, 400)
  }

  const sessionId = activeSession[0].id

  const duplicate = await sql`
    SELECT id FROM attendance_records WHERE student_id = ${studentId} AND session_id = ${sessionId}
  `
  if (duplicate.length > 0) {
    return c.json({ success: false, message: 'تم تسجيل حضورك في هذه المحاضرة مسبقاً.' }, 409)
  }

  await sql`
    INSERT INTO attendance_records (session_id, course_id, student_id, scanned_at, status)
    VALUES (${sessionId}, ${courseId}, ${studentId}, NOW(), 'present')
  `

  const stats = await sql`
    SELECT COUNT(DISTINCT s.id) AS total_sessions, COUNT(DISTINCT ar.id) AS attended_sessions
    FROM attendance_sessions s
    LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = ${studentId}
    WHERE s.course_id = ${courseId}
  `
  const total = parseInt(stats[0].total_sessions) || 0
  const attended = parseInt(stats[0].attended_sessions) || 0
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0

  return c.json({
    success: true,
    message: 'تم تسجيل الحضور بنجاح! ✅',
    data: { sessionId, courseId, attendancePercentage: percentage },
  })
})

// GET /api/attendance/active-sessions — student
router.get('/active-sessions', authMiddleware(), checkRole('student'), async (c) => {
  const sql = getDb(c.env)
  const result = await sql`
    SELECT s.id, s.session_name, s.session_date, c.course_name, c.course_code
    FROM attendance_sessions s
    JOIN courses c ON s.course_id = c.id
    JOIN enrollments e ON c.id = e.course_id
    WHERE e.student_id = ${c.get('user').id} AND s.is_active = true
  `
  return c.json({ success: true, data: result })
})

// GET /api/attendance/sessions/:sessionId — session records
router.get('/sessions/:sessionId', authMiddleware(), async (c) => {
  const sessionId = c.req.param('sessionId')
  const sql = getDb(c.env)

  const records = await sql`
    SELECT ar.id, ar.scanned_at, ar.is_manual_override,
           u.id AS student_db_id, u.full_name, u.student_id AS university_id, u.email,
           (
             SELECT COUNT(DISTINCT ar2.id)
             FROM attendance_records ar2
             JOIN attendance_sessions s2 ON ar2.session_id = s2.id
             WHERE ar2.student_id = u.id AND s2.course_id = s.course_id
           ) AS total_attended,
           (
             SELECT COUNT(DISTINCT s3.id)
             FROM attendance_sessions s3
             WHERE s3.course_id = s.course_id
           ) AS total_sessions
    FROM attendance_records ar
    JOIN users u ON ar.student_id = u.id
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE ar.session_id = ${sessionId}
    ORDER BY ar.scanned_at DESC
  `
  const recordsWithPercentage = records.map(r => ({
    ...r,
    attendance_percentage: r.total_sessions > 0
      ? Math.round((r.total_attended / r.total_sessions) * 100)
      : 0,
  }))
  return c.json({ success: true, data: { records: recordsWithPercentage } })
})

// GET /api/attendance/student — student history
router.get('/student', authMiddleware(), checkRole('student'), async (c) => {
  const sql = getDb(c.env)
  const result = await sql`
    SELECT ar.*, s.session_name, s.session_date, c.course_name, c.course_code
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    JOIN courses c ON s.course_id = c.id
    WHERE ar.student_id = ${c.get('user').id}
    ORDER BY s.session_date DESC
  `
  return c.json({ success: true, data: { attendance: result } })
})

// POST /api/attendance/manual-override — professor
router.post('/manual-override', authMiddleware(), checkRole('professor'), async (c) => {
  const { sessionId, studentId, reason } = await c.req.json()
  const sql = getDb(c.env)

  const sessionCheck = await sql`
    SELECT s.id, s.course_id FROM attendance_sessions s
    JOIN courses c ON s.course_id = c.id
    WHERE s.id = ${sessionId} AND c.professor_id = ${c.get('user').id}
  `
  if (sessionCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const courseId = sessionCheck[0].course_id

  const existing = await sql`
    SELECT id FROM attendance_records WHERE session_id = ${sessionId} AND student_id = ${studentId}
  `
  if (existing.length > 0) return c.json({ success: false, message: 'Student already attended.' }, 409)

  const result = await sql`
    INSERT INTO attendance_records (session_id, course_id, student_id, is_manual_override, override_reason, scanned_at, status)
    VALUES (${sessionId}, ${courseId}, ${studentId}, true, ${reason || 'Manual override'}, NOW(), 'present')
    RETURNING *
  `
  return c.json({ success: true, message: 'Manual attendance recorded.', data: { record: result[0] } })
})

export default router
