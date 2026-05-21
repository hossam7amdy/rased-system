import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { generateToken, authMiddleware, checkRole } from '../auth.js'
import { getDb } from '../db.js'

const router = new Hono()

router.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) {
    return c.json({ success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان.' }, 400)
  }
  const sql = getDb(c.env)
  const users = await sql`SELECT * FROM users WHERE email = ${email}`
  if (users.length === 0) {
    return c.json({ success: false, message: 'بيانات الدخول غير صحيحة.' }, 401)
  }
  const user = users[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return c.json({ success: false, message: 'بيانات الدخول غير صحيحة.' }, 401)
  }
  const accessToken = await generateToken(user, c.env)
  const { password_hash, ...userData } = user
  return c.json({ success: true, message: 'تم تسجيل الدخول بنجاح.', data: { user: userData, accessToken } })
})

router.post('/register', authMiddleware(), checkRole('admin', 'professor'), async (c) => {
  const { email, password, role, fullName, studentId } = await c.req.json()
  if (!email || !password || !role || !fullName) {
    return c.json({ success: false, message: 'جميع الحقول الأساسية مطلوبة.' }, 400)
  }
  if (role === 'student' && !studentId) {
    return c.json({ success: false, message: 'يجب إدخال الرقم الجامعي للطالب.' }, 400)
  }
  const sql = getDb(c.env)
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`
  if (existing.length > 0) {
    return c.json({ success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل.' }, 409)
  }
  const passwordHash = await bcrypt.hash(password, 8)
  const finalStudentId = role === 'student' && studentId ? studentId : null
  try {
    const result = await sql`
      INSERT INTO users (email, password_hash, role, full_name, student_id)
      VALUES (${email}, ${passwordHash}, ${role}, ${fullName}, ${finalStudentId})
      RETURNING id, email, role, full_name, student_id, created_at
    `
    return c.json({ success: true, message: 'تم إنشاء الحساب بنجاح.', data: { user: result[0] } }, 201)
  } catch (err) {
    if (err.code === '23505') {
      return c.json({ success: false, message: 'البريد الإلكتروني أو الرقم الجامعي موجود مسبقاً.' }, 409)
    }
    throw err
  }
})

router.get('/profile', authMiddleware(), async (c) => {
  const userId = c.get('user').id
  const sql = getDb(c.env)
  const result = await sql`
    SELECT id, email, role, full_name, student_id, created_at FROM users WHERE id = ${userId}
  `
  if (result.length === 0) {
    return c.json({ success: false, message: 'المستخدم غير موجود.' }, 404)
  }
  return c.json({ success: true, data: { user: result[0] } })
})

export default router
