import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes       from './routes/auth.js'
import coursesRoutes    from './routes/courses.js'
import attendanceRoutes from './routes/attendance.js'
import analyticsRoutes  from './routes/analytics.js'
import adminRoutes      from './routes/admin.js'

const app = new Hono()

app.use('*', cors({
  origin: c => c.env?.FRONTEND_ORIGIN || '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.get('/api/health', c => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/api/auth',       authRoutes)
app.route('/api/courses',    coursesRoutes)
app.route('/api/attendance', attendanceRoutes)
app.route('/api/analytics',  analyticsRoutes)
app.route('/api/admin',      adminRoutes)

app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ success: false, message: 'Internal Server Error' }, 500)
})

export default app
