import type { Test } from "supertest";
import request from "supertest";
import { createApp } from "../app.ts";
import { generateToken } from "../middleware/auth.ts";
import { state } from "./setup.ts";

// Re-export so importing helpers registers setup's before/after hooks.
export { state } from "./setup.ts";
export { generateToken };

const app = createApp();

type Method = "get" | "post" | "patch" | "delete";

export function req(
  method: Method,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Test {
  let r = request(app)[method](`/api${path}`);
  if (opts.token) r = r.set("Authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) r = r.send(opts.body as object);
  return r;
}

let counter = 0;
export const uniq = (prefix: string): string =>
  `${prefix}-${Date.now()}-${counter++}`;

interface Row {
  id: string;
  email?: string;
  role?: "admin" | "professor" | "student";
  full_name?: string;
  student_id?: string | null;
}

export async function makeStudent(): Promise<Row> {
  const email = `${uniq("stu")}@rased.edu`;
  const res = await state.pool.query<Row>(
    `INSERT INTO users (email, password_hash, role, full_name, student_id)
     VALUES ($1, 'x', 'student', $2, $3)
     RETURNING id, email, role, full_name, student_id`,
    [email, "Ad-hoc Student", uniq("UID")],
  );
  return res.rows[0] as Row;
}

export async function makeProfessor(): Promise<Row> {
  const email = `${uniq("prof")}@rased.edu`;
  const res = await state.pool.query<Row>(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1, 'x', 'professor', $2)
     RETURNING id, email, role, full_name, student_id`,
    [email, "Ad-hoc Professor"],
  );
  return res.rows[0] as Row;
}

export async function makeCourse(professorId = state.prof.id): Promise<string> {
  const res = await state.pool.query<{ id: string }>(
    `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
     VALUES ($1, $2, $3, 'Fall', '2025-2026')
     RETURNING id`,
    [uniq("C"), "Ad-hoc Course", professorId],
  );
  return (res.rows[0] as { id: string }).id;
}

export async function makeSession(
  courseId: string,
  active = true,
): Promise<string> {
  const res = await state.pool.query<{ id: string }>(
    `INSERT INTO attendance_sessions (course_id, session_name, session_date, start_time, is_active)
     VALUES ($1, $2, CURRENT_DATE, NOW(), $3)
     RETURNING id`,
    [courseId, uniq("S"), active],
  );
  return (res.rows[0] as { id: string }).id;
}

export async function enroll(
  studentId: string,
  courseId: string,
): Promise<void> {
  await state.pool.query(
    `INSERT INTO enrollments (course_id, student_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [courseId, studentId],
  );
}

export function tokenFor(row: Row): string {
  return generateToken({
    id: row.id,
    email: row.email ?? "",
    role: row.role ?? "student",
    full_name: row.full_name ?? "",
    student_id: row.student_id ?? null,
  });
}
