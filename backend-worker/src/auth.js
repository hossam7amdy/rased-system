import { SignJWT, jwtVerify } from 'jose'

export async function generateToken(user, env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    student_id: user.student_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret)
}

export function authMiddleware() {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Access denied. No token provided.' }, 401)
    }
    const token = authHeader.slice(7)
    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET)
      const { payload } = await jwtVerify(token, secret)
      c.set('user', payload)
      await next()
    } catch (err) {
      const expired = err.code === 'ERR_JWT_EXPIRED'
      return c.json(
        { success: false, message: expired ? 'Token expired. Please login again.' : 'Invalid token.' },
        401,
      )
    }
  }
}

export function checkRole(...roles) {
  return async (c, next) => {
    const user = c.get('user')
    if (!roles.includes(user?.role)) {
      return c.json({ success: false, message: 'Access denied. Insufficient permissions.' }, 403)
    }
    await next()
  }
}
