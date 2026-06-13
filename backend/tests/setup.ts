import { after, before } from "node:test";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { createApp } from "../app.ts";
import { generateToken } from "../middleware/auth.ts";
import type { User } from "../modules/auth/auth.model.ts";
import { applySchema } from "../scripts/init-db.ts";
import { CacheClient } from "../shared/cache/cache-client.ts";
import { ConfigToken } from "../shared/config/config.ts";
import { Database } from "../shared/database/database.ts";

export const testApp = createApp();
const config = testApp.resolve(ConfigToken);

const isTestDb =
  /^[a-z][a-z0-9_]*$/.test(config.db.name) && /test/i.test(config.db.name);
if (!isTestDb) {
  throw new Error(
    `Refusing to run integration tests: DB_NAME='${config.db.name}' does not look like a test DB.`,
  );
}

export const PASSWORD = "int-pass-123";

// Shared fixture state, populated by the before() hook below.
export const state = {
  tok: { admin: "", prof: "", student: "" },
  prof: null as unknown as User,
  student: null as unknown as User,
  admin: null as unknown as User,
  courseId: "",
  sessionId: "",
  creds: { prof: { email: "int-prof@rased.edu", password: PASSWORD } },
};

// Uses a throwaway pool on the maintenance `postgres` DB — can't CREATE DATABASE
// while connected to the target, and the shared `db` pool must stay open for applySchema.
async function ensureDatabase(): Promise<void> {
  const admin = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: "postgres",
  });
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.db.name],
    );
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE ${config.db.name}`);
    }
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // duplicate_database
  } finally {
    await admin.end();
  }
}

async function upsertUser(u: Partial<User>): Promise<User> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const res = await db.query<User>(
    `INSERT INTO users (email, password_hash, role, full_name, student_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id, email, role, full_name, student_id`,
    [u.email, hash, u.role, u.full_name, u.student_id ?? null],
  );
  return res.rows[0] as User;
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

  const course = await db.query<{ id: string }>(
    `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_code) DO UPDATE SET course_name = EXCLUDED.course_name
     RETURNING id`,
    ["INT-101", "Integration Course", state.prof.id, "Fall", "2025-2026"],
  );
  state.courseId = (course.rows[0] as { id: string }).id;

  await db.query(
    `INSERT INTO enrollments (course_id, student_id)
     VALUES ($1, $2) ON CONFLICT (course_id, student_id) DO NOTHING`,
    [state.courseId, state.student.id],
  );

  // one canonical active session, idempotent via marker session_name
  const session = await db.query<{ id: string }>(
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
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM attendance_sessions
       WHERE course_id = $1 AND session_name = 'INTEGRATION_SESSION' LIMIT 1`,
      [state.courseId],
    );
    state.sessionId = (existing.rows[0] as { id: string }).id;
  }

  await db.query(
    `INSERT INTO attendance_records (session_id, course_id, student_id, scanned_at, status)
     VALUES ($1, $2, $3, NOW(), 'present')
     ON CONFLICT (session_id, student_id) DO NOTHING`,
    [state.sessionId, state.courseId, state.student.id],
  );

  const jwtConfig = config.jwt;
  state.tok.admin = generateToken(state.admin, jwtConfig);
  state.tok.prof = generateToken(state.prof, jwtConfig);
  state.tok.student = generateToken(state.student, jwtConfig);
}

const db = testApp.resolve(Database);
const cache = testApp.resolve(CacheClient);

before(async () => {
  await ensureDatabase();
  await applySchema(db);
  await cache.connect();
  await cache.clear();
  await seed();
});

after(async () => {
  await db.query(
    "TRUNCATE attendance_records, attendance_sessions, enrollments, courses, users CASCADE",
  );
  await cache.clear();
  await testApp.dispose();
});
