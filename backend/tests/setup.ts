import { after, before } from "node:test";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { createApp } from "../app.ts";
import pool from "../config/database.ts";
import redis from "../config/redis.ts";
import { generateToken } from "../middleware/auth.ts";
import { applySchema } from "../scripts/init-db.ts";

const DB_NAME = process.env.DB_NAME ?? "";
const isTestDb = /^[a-z][a-z0-9_]*$/.test(DB_NAME) && /test/i.test(DB_NAME);
if (!isTestDb) {
  throw new Error(
    `Refusing to run integration tests: DB_NAME='${DB_NAME}' does not look like a test DB.`,
  );
}

export const PASSWORD = "int-pass-123";

export const app = createApp();

interface SeededUser {
  id: string;
  email: string;
  role: "admin" | "professor" | "student";
  full_name: string;
  student_id: string | null;
}

// Shared fixture state, populated by the before() hook below.
export const state = {
  pool,
  tok: { admin: "", prof: "", student: "" },
  prof: null as unknown as SeededUser,
  student: null as unknown as SeededUser,
  admin: null as unknown as SeededUser,
  courseId: "",
  sessionId: "",
  creds: { prof: { email: "int-prof@rased.edu", password: PASSWORD } },
};

async function ensureDatabase(): Promise<void> {
  const admin = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "postgres",
  });
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME],
    );
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE ${DB_NAME}`);
    }
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // duplicate_database
  } finally {
    await admin.end();
  }
}

async function upsertUser(u: {
  email: string;
  role: SeededUser["role"];
  full_name: string;
  student_id?: string | null;
}): Promise<SeededUser> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const res = await pool.query<SeededUser>(
    `INSERT INTO users (email, password_hash, role, full_name, student_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id, email, role, full_name, student_id`,
    [u.email, hash, u.role, u.full_name, u.student_id ?? null],
  );
  return res.rows[0] as SeededUser;
}

async function seed(): Promise<void> {
  state.admin = await upsertUser({
    email: "admin@rased.edu",
    role: "admin",
    full_name: "System Administrator",
  });

  state.prof = await upsertUser({
    email: state.creds.prof.email,
    role: "professor",
    full_name: "Professor",
  });
  state.student = await upsertUser({
    email: "int-student@rased.edu",
    role: "student",
    full_name: "Student",
    student_id: "INT-STU-1",
  });

  const course = await pool.query<{ id: string }>(
    `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_code) DO UPDATE SET course_name = EXCLUDED.course_name
     RETURNING id`,
    ["INT-101", "Integration Course", state.prof.id, "Fall", "2025-2026"],
  );
  state.courseId = (course.rows[0] as { id: string }).id;

  await pool.query(
    `INSERT INTO enrollments (course_id, student_id)
     VALUES ($1, $2) ON CONFLICT (course_id, student_id) DO NOTHING`,
    [state.courseId, state.student.id],
  );

  // one canonical active session, idempotent via marker session_name
  const session = await pool.query<{ id: string }>(
    `INSERT INTO attendance_sessions (course_id, session_name, session_date, start_time, is_active)
     SELECT $1, 'INTEGRATION_SESSION', CURRENT_DATE, NOW(), true
     WHERE NOT EXISTS (
       SELECT 1 FROM attendance_sessions
       WHERE course_id = $1 AND session_name = 'INTEGRATION_SESSION'
     )
     RETURNING id`,
    [state.courseId],
  );
  if (session.rows.length > 0) {
    state.sessionId = (session.rows[0] as { id: string }).id;
  } else {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM attendance_sessions
       WHERE course_id = $1 AND session_name = 'INTEGRATION_SESSION' LIMIT 1`,
      [state.courseId],
    );
    state.sessionId = (existing.rows[0] as { id: string }).id;
  }

  await pool.query(
    `INSERT INTO attendance_records (session_id, course_id, student_id, scanned_at, status)
     VALUES ($1, $2, $3, NOW(), 'present')
     ON CONFLICT (session_id, student_id) DO NOTHING`,
    [state.sessionId, state.courseId, state.student.id],
  );

  state.tok.admin = generateToken(state.admin);
  state.tok.prof = generateToken(state.prof);
  state.tok.student = generateToken(state.student);
}

before(async () => {
  await ensureDatabase();
  await applySchema(pool);
  await seed();
});

after(async () => {
  await pool.query(
    "TRUNCATE attendance_records, attendance_sessions, enrollments, courses, users CASCADE",
  );
  await Promise.allSettled([pool.end(), redis.close(), app.dispose()]);
});
