import { Hono } from 'hono'
import { authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.get('/course/:courseId', authMiddleware(), checkRole('professor'), async (c) => {
  const courseId = c.req.param('courseId')
  const sql = getDb(c.env)

  const courseCheck = await sql`
    SELECT * FROM courses WHERE id = ${courseId} AND professor_id = ${c.get('user').id}
  `
  if (courseCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)

  const [statsResult, trendResult, atRiskResult] = await Promise.all([
    sql`
      SELECT COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT e.student_id) as total_students,
             COUNT(DISTINCT ar.id) as total_attendance_records
      FROM courses c
      LEFT JOIN attendance_sessions s ON c.id = s.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN attendance_records ar ON s.id = ar.session_id
      WHERE c.id = ${courseId}
    `,
    sql`
      SELECT s.id, s.session_name, s.session_date, COUNT(ar.id) as attendance_count
      FROM attendance_sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id
      WHERE s.course_id = ${courseId}
      GROUP BY s.id, s.session_name, s.session_date
      ORDER BY s.session_date DESC
      LIMIT 10
    `,
    sql`
      SELECT u.id, u.full_name, u.student_id,
             COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT ar.id) as attended_sessions,
             ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      CROSS JOIN attendance_sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
      WHERE e.course_id = ${courseId} AND s.course_id = ${courseId}
      GROUP BY u.id, u.full_name, u.student_id
      HAVING COUNT(DISTINCT s.id) > 0
        AND (CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / COUNT(DISTINCT s.id)) < 0.25
      ORDER BY attendance_percentage ASC
    `,
  ])

  const stats = statsResult[0]
  return c.json({
    success: true,
    data: {
      course: courseCheck[0],
      statistics: {
        total_sessions: parseInt(stats.total_sessions),
        total_students: parseInt(stats.total_students),
        total_attendance: parseInt(stats.total_attendance_records),
        average_attendance:
          parseInt(stats.total_sessions) > 0
            ? Math.round(
                (parseInt(stats.total_attendance_records) /
                  (parseInt(stats.total_sessions) * parseInt(stats.total_students))) *
                  100,
              )
            : 0,
      },
      attendance_trend: trendResult.reverse(),
      at_risk_students: atRiskResult,
    },
  })
})

router.get('/student', authMiddleware(), checkRole('student'), async (c) => {
  const studentId = c.get('user').id
  const sql = getDb(c.env)

  const [statsResult, coursesResult, recentResult] = await Promise.all([
    sql`
      SELECT COUNT(DISTINCT e.course_id) as enrolled_courses,
             COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT ar.id) as attended_sessions
      FROM enrollments e
      LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
      LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = ${studentId}
      WHERE e.student_id = ${studentId}
    `,
    sql`
      SELECT c.course_name, c.course_code,
             COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT ar.id) as attended_sessions,
             ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN attendance_sessions s ON c.id = s.course_id
      LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = ${studentId}
      WHERE e.student_id = ${studentId}
      GROUP BY c.id, c.course_name, c.course_code
      ORDER BY attendance_percentage DESC
    `,
    sql`
      SELECT c.course_name, s.session_name, s.session_date, ar.scanned_at
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE ar.student_id = ${studentId}
      ORDER BY ar.scanned_at DESC
      LIMIT 10
    `,
  ])

  const stats = statsResult[0]
  return c.json({
    success: true,
    data: {
      statistics: {
        enrolled_courses: parseInt(stats.enrolled_courses),
        total_sessions: parseInt(stats.total_sessions),
        attended_sessions: parseInt(stats.attended_sessions),
        overall_percentage:
          parseInt(stats.total_sessions) > 0
            ? Math.round((parseInt(stats.attended_sessions) / parseInt(stats.total_sessions)) * 100)
            : 0,
      },
      courses: coursesResult,
      recent_attendance: recentResult,
    },
  })
})

// CSV export (replaces Excel — works in Workers without Node deps)
router.get('/export', authMiddleware(), checkRole('professor'), async (c) => {
  const { courseId, sessionId } = c.req.query()
  if (!courseId) return c.json({ success: false, message: 'Course ID is required.' }, 400)
  const sql = getDb(c.env)

  const courseCheck = await sql`
    SELECT * FROM courses WHERE id = ${courseId} AND professor_id = ${c.get('user').id}
  `
  if (courseCheck.length === 0) return c.json({ success: false, message: 'Access denied.' }, 403)
  const course = courseCheck[0]

  let rows = []
  let headers = []

  if (sessionId) {
    headers = ['Student ID', 'Full Name', 'Email', 'Status', 'Scan Time', 'Manual Override']
    const data = await sql`
      SELECT u.student_id, u.full_name, u.email, ar.scanned_at, ar.is_manual_override
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = ${sessionId}
      WHERE e.course_id = ${courseId}
      ORDER BY u.full_name
    `
    rows = data.map(r => [
      r.student_id,
      r.full_name,
      r.email,
      r.scanned_at ? 'Present' : 'Absent',
      r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '-',
      r.is_manual_override ? 'Yes' : 'No',
    ])
  } else {
    headers = ['Student ID', 'Full Name', 'Total Sessions', 'Attended', 'Percentage', 'Status']
    const data = await sql`
      SELECT u.student_id, u.full_name,
             COUNT(DISTINCT s.id) as total_sessions,
             COUNT(DISTINCT ar.id) as attended_sessions,
             ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as percentage
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
      LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
      WHERE e.course_id = ${courseId}
      GROUP BY u.id, u.student_id, u.full_name
      ORDER BY u.full_name
    `
    rows = data.map(r => {
      const pct = parseFloat(r.percentage) || 0
      return [
        r.student_id,
        r.full_name,
        r.total_sessions,
        r.attended_sessions,
        `${pct}%`,
        pct < 25 ? 'At Risk' : pct < 75 ? 'Warning' : 'Good',
      ]
    })
  }

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${course.course_code}_attendance.csv"`,
    },
  })
})

export default router
