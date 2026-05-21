const QR_TTL_SECONDS = 8

function encodeToken(data) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
  return `dummy_iv:dummy_tag:${b64}`
}

function decodeToken(token) {
  const parts = token.split(':')
  const b64 = parts.length === 3 ? parts[2] : token
  return JSON.parse(decodeURIComponent(escape(atob(b64))))
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function getCurrentToken(courseId, db) {
  const id = String(courseId)
  const { data } = await db.from('active_qr_sessions').select('token, issued_at').eq('course_id', id).single()

  if (data) {
    const ageMs = Date.now() - new Date(data.issued_at).getTime()
    if (ageMs < QR_TTL_SECONDS * 1000) {
      return { token: data.token, remainingSeconds: Math.ceil(QR_TTL_SECONDS - ageMs / 1000) }
    }
  }

  return generateAndStore(courseId, db)
}

export async function generateAndStore(courseId, db) {
  const id = String(courseId)
  const token = encodeToken({ sId: id, t: Date.now() })
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString()

  await db.from('active_qr_sessions').upsert(
    { course_id: id, token, issued_at: new Date().toISOString(), expires_at: expiresAt },
    { onConflict: 'course_id' },
  )

  return { token, remainingSeconds: QR_TTL_SECONDS }
}

export async function validateToken(token, db) {
  try {
    const decoded = decodeToken(token)
    const courseId = decoded?.sId
    if (!courseId) return { valid: false, message: 'بيانات الرمز غير مكتملة.' }

    const { data: active } = await db
      .from('active_qr_sessions')
      .select('token')
      .eq('course_id', courseId)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!active) return { valid: false, message: 'انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.' }
    if (active.token !== token) return { valid: false, message: 'هذا الرمز لم يعد صالحاً، امسح الكود الظاهر حالياً.' }

    const tokenHash = await sha256hex(token)
    const { data: used } = await db.from('used_qr_tokens').select('token_hash').eq('token_hash', tokenHash).single()
    if (used) return { valid: false, message: 'تم استخدام هذا الرمز مسبقاً.' }

    await db.from('used_qr_tokens').insert({ token_hash: tokenHash })

    return { valid: true, courseId }
  } catch {
    return { valid: false, message: 'رمز غير صالح أو تالف.' }
  }
}

export async function stopSession(courseId, db) {
  await db.from('active_qr_sessions').delete().eq('course_id', String(courseId))
}
