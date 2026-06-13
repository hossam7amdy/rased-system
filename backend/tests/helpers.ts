import type { Test } from "supertest";
import request from "supertest";
import type { User } from "../modules/auth/auth.model.ts";
import { JwtService } from "../modules/auth/jwt.service.ts";
import { Database } from "../shared/database/database.ts";
import { state, testApp } from "./setup.ts";

// Re-export so importing helpers registers setup's before/after hooks.
export { state } from "./setup.ts";

const db = testApp.resolve(Database);

type Method = "get" | "post" | "patch" | "delete";

export function req(
  method: Method,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Test {
  let r = request(testApp)[method](`/api${path}`);
  if (opts.token) r = r.set("Authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) r = r.send(opts.body as object);
  return r;
}

let counter = 0;
export const uniq = (prefix: string): string =>
  `${prefix}-${Date.now()}-${counter++}`;

export async function makeStudent(): Promise<User> {
  const email = `${uniq("stu")}@rased.edu`;
  const res = await db.query<User>(
    `INSERT INTO users (email, password_hash, role, full_name, student_id)
     VALUES ($1, 'x', 'student', $2, $3)
     RETURNING id, email, role, full_name, student_id`,
    [email, "Ad-hoc Student", uniq("UID")],
  );
  return res.rows[0] as User;
}

export async function makeProfessor(): Promise<User> {
  const email = `${uniq("prof")}@rased.edu`;
  const res = await db.query<User>(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1, 'x', 'professor', $2)
     RETURNING id, email, role, full_name, student_id`,
    [email, "Ad-hoc Professor"],
  );
  return res.rows[0] as User;
}

export async function makeCourse(professorId = state.prof.id): Promise<string> {
  const res = await db.query<{ id: string }>(
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
  const res = await db.query<{ id: string }>(
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
  await db.query(
    `INSERT INTO enrollments (course_id, student_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [courseId, studentId],
  );
}

export function tokenFor(row: User): string {
  return testApp.resolve(JwtService).signAccess({
    id: row.id,
    email: row.email ?? "",
    role: row.role ?? "student",
    full_name: row.full_name ?? "",
    student_id: row.student_id ?? null,
  });
}
