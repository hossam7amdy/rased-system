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
  const db = getDb(c.env)
  const { data: user } = await db.from('users').select('*').eq('email', email).single()
  if (!user) return c.json({ success: false, message: 'بيانات الدخول غير صحيحة.' }, 401)

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return c.json({ success: false, message: 'بيانات الدخول غير صحيحة.' }, 401)

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
  const db = getDb(c.env)
  const { data: existing } = await db.from('users').select('id').eq('email', email).single()
  if (existing) return c.json({ success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل.' }, 409)

  const passwordHash = await bcrypt.hash(password, 8)
  const finalStudentId = role === 'student' && studentId ? studentId : null

  const { data, error } = await db
    .from('users')
    .insert({ email, password_hash: passwordHash, role, full_name: fullName, student_id: finalStudentId })
    .select('id, email, role, full_name, student_id, created_at')
    .single()

  if (error?.code === '23505') {
    return c.json({ success: false, message: 'البريد الإلكتروني أو الرقم الجامعي موجود مسبقاً.' }, 409)
  }
  if (error) throw error
  return c.json({ success: true, message: 'تم إنشاء الحساب بنجاح.', data: { user: data } }, 201)
})

router.get('/profile', authMiddleware(), async (c) => {
  const db = getDb(c.env)
  const { data } = await db
    .from('users')
    .select('id, email, role, full_name, student_id, created_at')
    .eq('id', c.get('user').id)
    .single()
  if (!data) return c.json({ success: false, message: 'المستخدم غير موجود.' }, 404)
  return c.json({ success: true, data: { user: data } })
})

export default router
