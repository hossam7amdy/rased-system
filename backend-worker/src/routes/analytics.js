import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.get('/course/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = Number(c.req.param('courseId'))
  const db = getDb(c.env)

  const { data: course } = await db.from('courses').select('*').eq('id', courseId).eq('professor_id', c.get('user').id).single()
  if (!course) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { data, error } = await db.rpc('rpc_get_course_analytics', { p_course_id: courseId })
  if (error) throw error

  const stats = data?.statistics || {}
  return c.json({
    success: true,
    data: {
      course,
      statistics: {
        total_sessions: Number(stats.total_sessions || 0),
        total_students: Number(stats.total_students || 0),
        total_attendance: Number(stats.total_attendance_records || 0),
        average_attendance: Number(stats.total_sessions) > 0
          ? Math.round((Number(stats.total_attendance_records) / (Number(stats.total_sessions) * Number(stats.total_students))) * 100)
          : 0,
      },
      attendance_trend: data?.attendance_trend || [],
      at_risk_students: data?.at_risk_students || [],
    },
  })
})

router.get('/student', authMiddleware(), checkRole('student'), async (c) => {
  const db = getDb(c.env)
  const { data, error } = await db.rpc('rpc_get_student_analytics', { p_student_id: c.get('user').id })
  if (error) throw error

  const stats = data?.statistics || {}
  return c.json({
    success: true,
    data: {
      statistics: {
        enrolled_courses: Number(stats.enrolled_courses || 0),
        total_sessions: Number(stats.total_sessions || 0),
        attended_sessions: Number(stats.attended_sessions || 0),
        overall_percentage: Number(stats.total_sessions) > 0
          ? Math.round((Number(stats.attended_sessions) / Number(stats.total_sessions)) * 100)
          : 0,
      },
      courses: data?.courses || [],
      recent_attendance: data?.recent_attendance || [],
    },
  })
})

router.get('/export', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseId, sessionId } = c.req.query()
  if (!courseId) return c.json({ success: false, message: 'Course ID is required.' }, 400)
  const db = getDb(c.env)

  const { data: course } = await db.from('courses').select('*').eq('id', courseId).eq('professor_id', c.get('user').id).single()
  if (!course) return c.json({ success: false, message: 'Access denied.' }, 403)

  const { data: rows, error } = await db.rpc('rpc_export_course_attendance', {
    p_course_id: Number(courseId),
    p_session_id: sessionId ? Number(sessionId) : null,
  })
  if (error) throw error

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`

  let headers, csvRows
  if (sessionId) {
    headers = ['Student ID', 'Full Name', 'Email', 'Status', 'Scan Time', 'Manual Override']
    csvRows = (rows || []).map(r => [
      r.student_id, r.full_name, r.email,
      r.scanned_at ? 'Present' : 'Absent',
      r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '-',
      r.is_manual_override ? 'Yes' : 'No',
    ])
  } else {
    headers = ['Student ID', 'Full Name', 'Total Sessions', 'Attended', 'Percentage', 'Status']
    csvRows = (rows || []).map(r => {
      const pct = parseFloat(r.percentage) || 0
      return [r.student_id, r.full_name, r.total_sessions, r.attended_sessions, `${pct}%`,
        pct < 25 ? 'At Risk' : pct < 75 ? 'Warning' : 'Good']
    })
  }

  const csv = [headers, ...csvRows].map(row => row.map(escape).join(',')).join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${course.course_code}_attendance.csv"`,
    },
  })
})

export default router
