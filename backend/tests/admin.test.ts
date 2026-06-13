import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AdminService } from "../modules/admin/admin.service.ts";
import { Database } from "../shared/database/database.ts";
import { makeCourse, makeStudent, req, state, uniq } from "./helpers.ts";
import {
  AdminCourse,
  AdminStudent,
  AdminUser,
  BulkResult,
  EnrollmentRow,
  Err,
  ImportResult,
  okData,
  okMsgData,
} from "./schemas.ts";
import { testApp } from "./setup.ts";

test("GET /admin/users → 200 { users }", async () => {
  const res = await req("get", "/admin/users", { token: state.tok.admin });
  assert.equal(res.status, 200);
  okData(z.strictObject({ users: z.array(AdminUser) })).parse(res.body);
});

test("GET /admin/users → error envelope for non-admin", async () => {
  const res = await req("get", "/admin/users", { token: state.tok.prof });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /admin/students → 200 { students }", async () => {
  const res = await req("get", "/admin/students", { token: state.tok.admin });
  assert.equal(res.status, 200);
  okData(z.strictObject({ students: z.array(AdminStudent) })).parse(res.body);
});

test("GET /admin/students → error envelope without auth", async () => {
  const res = await req("get", "/admin/students");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /admin/courses → 200 { courses }", async () => {
  const res = await req("get", "/admin/courses", { token: state.tok.admin });
  assert.equal(res.status, 200);
  okData(z.strictObject({ courses: z.array(AdminCourse) })).parse(res.body);
});

test("GET /admin/courses → error envelope without auth", async () => {
  const res = await req("get", "/admin/courses");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("DELETE /admin/users/:id → 204 for a student", async () => {
  const student = await makeStudent();
  const res = await req("delete", `/admin/users/${student.id}`, {
    token: state.tok.admin,
  });
  assert.equal(res.status, 204);

  const remaining = await testApp
    .resolve(Database)
    .query("SELECT id FROM users WHERE id = $1", [student.id]);
  assert.equal(remaining.rows.length, 0);
});

test("DELETE /admin/users/:id → 404 for unknown id", async () => {
  const res = await req(
    "delete",
    "/admin/users/00000000-0000-0000-0000-000000000000",
    { token: state.tok.admin },
  );
  assert.equal(res.status, 404);
  Err.parse(res.body);
});

test("DELETE /admin/users/:id → 400 for malformed id", async () => {
  const res = await req("delete", "/admin/users/not-a-uuid", {
    token: state.tok.admin,
  });
  assert.equal(res.status, 400);
  Err.parse(res.body);
});

test("DELETE /admin/users/:id → 403 when admin deletes self", async () => {
  const res = await req("delete", `/admin/users/${state.admin.id}`, {
    token: state.tok.admin,
  });
  assert.equal(res.status, 403);
  Err.parse(res.body);
});

test("DELETE /admin/users/:id → error envelope for non-admin", async () => {
  const student = await makeStudent();
  const res = await req("delete", `/admin/users/${student.id}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

// Last-admin guard is unreachable over HTTP (the caller is always an admin, so a
// non-self admin target implies ≥2 admins). Exercised at the service layer where
// requesterId is controllable; the seed admin is the only admin in the fixture.
test("AdminService.deleteUser blocks deleting the last admin", async () => {
  const service = testApp.resolve(AdminService);
  await assert.rejects(
    () => service.deleteUser(state.admin.id, uniq("not-an-admin")),
    /آخر مسؤول/,
  );
});

test("POST /admin/enroll → 201 { enrollment }", async () => {
  const courseId = await makeCourse();
  const student = await makeStudent();
  const res = await req("post", "/admin/enroll", {
    token: state.tok.admin,
    body: { studentId: student.id, courseId },
  });
  assert.equal(res.status, 201);
  okMsgData(z.strictObject({ enrollment: EnrollmentRow })).parse(res.body);
});

test("POST /admin/enroll → error envelope for missing fields", async () => {
  const res = await req("post", "/admin/enroll", {
    token: state.tok.admin,
    body: {},
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /admin/enroll-bulk → 201 flat { enrolled, duplicates, errors }", async () => {
  const courseId = await makeCourse();
  const student = await makeStudent();
  const res = await req("post", "/admin/enroll-bulk", {
    token: state.tok.admin,
    body: { studentIds: [student.id], courseIds: [courseId] },
  });
  assert.equal(res.status, 201);
  BulkResult.parse(res.body);
});

test("POST /admin/enroll-bulk → error envelope for empty arrays", async () => {
  const res = await req("post", "/admin/enroll-bulk", {
    token: state.tok.admin,
    body: { studentIds: [], courseIds: [] },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /admin/enroll-import → 201 flat { total, enrolled, details }", async () => {
  const code = uniq("IMP");
  const courseRes = await testApp.resolve(Database).query<{ id: string }>(
    `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
     VALUES ($1, $2, $3, 'Fall', '2025-2026') RETURNING id`,
    [code, "Import Course", state.prof.id],
  );
  assert.ok(courseRes.rows[0]);
  const student = await makeStudent();
  const res = await req("post", "/admin/enroll-import", {
    token: state.tok.admin,
    body: {
      rows: [{ rowNum: 1, studentId: student.student_id, courseCode: code }],
    },
  });
  assert.equal(res.status, 201);
  ImportResult.parse(res.body);
});

test("POST /admin/enroll-import → error envelope for empty rows", async () => {
  const res = await req("post", "/admin/enroll-import", {
    token: state.tok.admin,
    body: { rows: [] },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});
