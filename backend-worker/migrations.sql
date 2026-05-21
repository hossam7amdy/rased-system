-- Run in Supabase SQL editor before deploying

CREATE TABLE IF NOT EXISTS active_qr_sessions (
  course_id  TEXT PRIMARY KEY,
  token      TEXT        NOT NULL,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS used_qr_tokens (
  token_hash TEXT PRIMARY KEY,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: auto-cleanup old rows (requires pg_cron extension in Supabase)
-- SELECT cron.schedule('cleanup-qr', '* * * * *', $$
--   DELETE FROM used_qr_tokens  WHERE used_at    < now() - interval '2 minutes';
--   DELETE FROM active_qr_sessions WHERE expires_at < now() - interval '1 minute';
-- $$);
