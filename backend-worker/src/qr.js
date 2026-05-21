// QR token service — stateless, Supabase-backed (replaces Redis + setInterval)
// Token format kept identical to original: "dummy_iv:dummy_tag:<base64json>"

const QR_TTL_SECONDS = 8

function encodeToken(data) {
  const json = JSON.stringify(data)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `dummy_iv:dummy_tag:${b64}`
}

function decodeToken(token) {
  const parts = token.split(':')
  if (parts.length === 3) {
    const json = decodeURIComponent(escape(atob(parts[2])))
    return JSON.parse(json)
  }
  const json = decodeURIComponent(escape(atob(token)))
  return JSON.parse(json)
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function getCurrentToken(courseId, sql) {
  const id = String(courseId)
  const rows = await sql`
    SELECT token, issued_at
    FROM active_qr_sessions
    WHERE course_id = ${id}
  `

  if (rows.length > 0) {
    const ageMs = Date.now() - new Date(rows[0].issued_at).getTime()
    if (ageMs < QR_TTL_SECONDS * 1000) {
      return { token: rows[0].token, remainingSeconds: Math.ceil(QR_TTL_SECONDS - ageMs / 1000) }
    }
  }

  return generateAndStore(courseId, sql)
}

export async function generateAndStore(courseId, sql) {
  const id = String(courseId)
  const token = encodeToken({ sId: id, t: Date.now() })
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString()

  await sql`
    INSERT INTO active_qr_sessions (course_id, token, expires_at)
    VALUES (${id}, ${token}, ${expiresAt})
    ON CONFLICT (course_id) DO UPDATE
      SET token = EXCLUDED.token, issued_at = now(), expires_at = EXCLUDED.expires_at
  `

  return { token, remainingSeconds: QR_TTL_SECONDS }
}

export async function validateToken(token, sql) {
  try {
    const decoded = decodeToken(token)
    const courseId = decoded?.sId
    if (!courseId) return { valid: false, message: 'بيانات الرمز غير مكتملة.' }

    const active = await sql`
      SELECT token FROM active_qr_sessions
      WHERE course_id = ${courseId} AND expires_at > now()
    `

    if (active.length === 0) {
      return { valid: false, message: 'انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.' }
    }

    if (active[0].token !== token) {
      return { valid: false, message: 'هذا الرمز لم يعد صالحاً، امسح الكود الظاهر حالياً.' }
    }

    const tokenHash = await sha256hex(token)
    const used = await sql`SELECT 1 FROM used_qr_tokens WHERE token_hash = ${tokenHash}`
    if (used.length > 0) {
      return { valid: false, message: 'تم استخدام هذا الرمز مسبقاً.' }
    }

    await sql`INSERT INTO used_qr_tokens (token_hash) VALUES (${tokenHash}) ON CONFLICT DO NOTHING`

    return { valid: true, courseId }
  } catch {
    return { valid: false, message: 'رمز غير صالح أو تالف.' }
  }
}

export async function stopSession(courseId, sql) {
  await sql`DELETE FROM active_qr_sessions WHERE course_id = ${String(courseId)}`
}
