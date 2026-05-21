-- Run ALL of this in Supabase SQL editor before deploying

-- ─── QR Tables ────────────────────────────────────────────────────────────────
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

-- ─── RPC: professor courses with counts ───────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_professor_courses(p_professor_id bigint)
RETURNS TABLE (
  id bigint, course_code text, course_name text, professor_id bigint,
  semester text, academic_year text, created_at timestamptz,
  student_count bigint, session_count bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, c.course_code, c.course_name, c.professor_id,
         c.semester, c.academic_year, c.created_at,
         COUNT(DISTINCT e.student_id) AS student_count,
         COUNT(DISTINCT s.id)         AS session_count
  FROM courses c
  LEFT JOIN enrollments e         ON c.id = e.course_id
  LEFT JOIN attendance_sessions s ON c.id = s.course_id
  WHERE c.professor_id = p_professor_id
  GROUP BY c.id
  ORDER BY c.created_at DESC;
$$;

-- ─── RPC: student courses with attendance ─────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_student_courses(p_student_id bigint)
RETURNS TABLE (
  id bigint, course_name text, course_code text, professor_name text,
  total_sessions bigint, attended_sessions bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, c.course_name, c.course_code, u.full_name AS professor_name,
         COUNT(DISTINCT s.id)  AS total_sessions,
         COUNT(DISTINCT ar.id) AS attended_sessions
  FROM enrollments e
  JOIN courses c  ON e.course_id = c.id
  JOIN users u    ON c.professor_id = u.id
  LEFT JOIN attendance_sessions s  ON c.id = s.course_id
  LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = p_student_id
  WHERE e.student_id = p_student_id
  GROUP BY c.id, u.full_name, e.enrolled_at
  ORDER BY e.enrolled_at DESC;
$$;

-- ─── RPC: course students with attendance ─────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_course_students(p_course_id bigint)
RETURNS TABLE (
  id bigint, full_name text, student_id text, email text,
  enrolled_at timestamptz, total_sessions bigint, attended_sessions bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.id, u.full_name, u.student_id, u.email,
         e.enrolled_at,
         COUNT(DISTINCT s.id)  AS total_sessions,
         COUNT(DISTINCT ar.id) AS attended_sessions
  FROM enrollments e
  JOIN users u ON e.student_id = u.id
  LEFT JOIN attendance_sessions s  ON e.course_id = s.course_id
  LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = u.id
  WHERE e.course_id = p_course_id
  GROUP BY u.id, e.enrolled_at
  ORDER BY u.full_name;
$$;

-- ─── RPC: course analytics ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_course_analytics(p_course_id bigint)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'statistics', (
      SELECT json_build_object(
        'total_sessions',           COUNT(DISTINCT s.id),
        'total_students',           COUNT(DISTINCT e.student_id),
        'total_attendance_records', COUNT(DISTINCT ar.id)
      )
      FROM courses c
      LEFT JOIN attendance_sessions s  ON c.id = s.course_id
      LEFT JOIN enrollments e          ON c.id = e.course_id
      LEFT JOIN attendance_records ar  ON s.id = ar.session_id
      WHERE c.id = p_course_id
    ),
    'attendance_trend', (
      SELECT COALESCE(json_agg(t ORDER BY t.session_date ASC), '[]'::json)
      FROM (
        SELECT s.id, s.session_name, s.session_date,
               COUNT(ar.id) AS attendance_count
        FROM attendance_sessions s
        LEFT JOIN attendance_records ar ON s.id = ar.session_id
        WHERE s.course_id = p_course_id
        GROUP BY s.id, s.session_name, s.session_date
        ORDER BY s.session_date DESC
        LIMIT 10
      ) t
    ),
    'at_risk_students', (
      SELECT COALESCE(json_agg(r), '[]'::json)
      FROM (
        SELECT u.id, u.full_name, u.student_id,
               COUNT(DISTINCT s.id)  AS total_sessions,
               COUNT(DISTINCT ar.id) AS attended_sessions,
               ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) AS attendance_percentage
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        CROSS JOIN attendance_sessions s
        LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
        WHERE e.course_id = p_course_id AND s.course_id = p_course_id
        GROUP BY u.id, u.full_name, u.student_id
        HAVING COUNT(DISTINCT s.id) > 0
          AND (CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / COUNT(DISTINCT s.id)) < 0.25
        ORDER BY attendance_percentage ASC
      ) r
    )
  );
$$;

-- ─── RPC: student analytics ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_student_analytics(p_student_id bigint)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'statistics', (
      SELECT json_build_object(
        'enrolled_courses',  COUNT(DISTINCT e.course_id),
        'total_sessions',    COUNT(DISTINCT s.id),
        'attended_sessions', COUNT(DISTINCT ar.id)
      )
      FROM enrollments e
      LEFT JOIN attendance_sessions s  ON e.course_id = s.course_id
      LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = p_student_id
      WHERE e.student_id = p_student_id
    ),
    'courses', (
      SELECT COALESCE(json_agg(c), '[]'::json)
      FROM (
        SELECT c.course_name, c.course_code,
               COUNT(DISTINCT s.id)  AS total_sessions,
               COUNT(DISTINCT ar.id) AS attended_sessions,
               ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) AS attendance_percentage
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN attendance_sessions s  ON c.id = s.course_id
        LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = p_student_id
        WHERE e.student_id = p_student_id
        GROUP BY c.id, c.course_name, c.course_code
        ORDER BY attendance_percentage DESC
      ) c
    ),
    'recent_attendance', (
      SELECT COALESCE(json_agg(r), '[]'::json)
      FROM (
        SELECT c.course_name, s.session_name, s.session_date, ar.scanned_at
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        JOIN courses c             ON s.course_id = c.id
        WHERE ar.student_id = p_student_id
        ORDER BY ar.scanned_at DESC
        LIMIT 10
      ) r
    )
  );
$$;

-- ─── RPC: session attendance with cumulative % ────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_get_session_attendance(p_session_id bigint)
RETURNS TABLE (
  id bigint, scanned_at timestamptz, is_manual_override boolean,
  student_db_id bigint, full_name text, university_id text, email text,
  total_attended bigint, total_sessions bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ar.id, ar.scanned_at, ar.is_manual_override,
         u.id AS student_db_id, u.full_name, u.student_id AS university_id, u.email,
         (SELECT COUNT(DISTINCT ar2.id)
          FROM attendance_records ar2
          JOIN attendance_sessions s2 ON ar2.session_id = s2.id
          WHERE ar2.student_id = u.id AND s2.course_id = s.course_id) AS total_attended,
         (SELECT COUNT(DISTINCT s3.id)
          FROM attendance_sessions s3
          WHERE s3.course_id = s.course_id) AS total_sessions
  FROM attendance_records ar
  JOIN users u                ON ar.student_id = u.id
  JOIN attendance_sessions s  ON ar.session_id = s.id
  WHERE ar.session_id = p_session_id
  ORDER BY ar.scanned_at DESC;
$$;

-- ─── RPC: student course stats (used after scan) ──────────────────────────────
CREATE OR REPLACE FUNCTION rpc_student_course_stats(p_student_id bigint, p_course_id bigint)
RETURNS TABLE (total_sessions bigint, attended_sessions bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT s.id)  AS total_sessions,
         COUNT(DISTINCT ar.id) AS attended_sessions
  FROM attendance_sessions s
  LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = p_student_id
  WHERE s.course_id = p_course_id;
$$;

-- ─── RPC: export attendance data ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_export_course_attendance(p_course_id bigint, p_session_id bigint DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE
    WHEN p_session_id IS NOT NULL THEN (
      SELECT COALESCE(json_agg(r), '[]'::json)
      FROM (
        SELECT u.student_id, u.full_name, u.email, ar.scanned_at, ar.is_manual_override
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = p_session_id
        WHERE e.course_id = p_course_id
        ORDER BY u.full_name
      ) r
    )
    ELSE (
      SELECT COALESCE(json_agg(r), '[]'::json)
      FROM (
        SELECT u.student_id, u.full_name,
               COUNT(DISTINCT s.id)  AS total_sessions,
               COUNT(DISTINCT ar.id) AS attended_sessions,
               ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) AS percentage
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        LEFT JOIN attendance_sessions s  ON e.course_id = s.course_id
        LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = u.id
        WHERE e.course_id = p_course_id
        GROUP BY u.id, u.student_id, u.full_name
        ORDER BY u.full_name
      ) r
    )
  END;
$$;
