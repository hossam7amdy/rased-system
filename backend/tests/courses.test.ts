import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  makeCourse,
  makeProfessor,
  makeStudent,
  req,
  state,
  uniq,
} from "./helpers.ts";
import {
  CourseDetail,
  CourseRow,
  CourseStudent,
  EnrollmentRow,
  Err,
  okData,
  okMsgData,
  ProfCourse,
  StudentCourse,
} from "./schemas.ts";

const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

test("POST /courses → 201 { course }", async () => {
  const res = await req("post", "/courses", {
    token: state.tok.prof,
    body: {
      courseCode: uniq("NEW"),
      courseName: "New Course",
      semester: "Fall",
      academicYear: "2025-2026",
    },
  });
  assert.equal(res.status, 201);
  okMsgData(z.strictObject({ course: CourseRow })).parse(res.body);
});

test("POST /courses → error envelope for non-professor", async () => {
  const res = await req("post", "/courses", {
    token: state.tok.student,
    body: {
      courseCode: uniq("X"),
      courseName: "X",
      semester: "F",
      academicYear: "Y",
    },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses → 200 { courses } (professor: counts as strings)", async () => {
  const res = await req("get", "/courses", { token: state.tok.prof });
  assert.equal(res.status, 200);
  okData(z.strictObject({ courses: z.array(ProfCourse) })).parse(res.body);
});

test("GET /courses → error envelope for admin role", async () => {
  const res = await req("get", "/courses", { token: state.tok.admin });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses → 200 sibling { courses } (student branch)", async () => {
  const res = await req("get", "/courses", { token: state.tok.student });
  assert.equal(res.status, 200);
  z.strictObject({
    success: z.literal(true),
    courses: z.array(StudentCourse),
  }).parse(res.body);
});

test("GET /courses/my-courses → 200 sibling { success, courses }", async () => {
  const res = await req("get", "/courses/my-courses", {
    token: state.tok.student,
  });
  assert.equal(res.status, 200);
  z.strictObject({
    success: z.literal(true),
    courses: z.array(StudentCourse),
  }).parse(res.body);
});

test("GET /courses/my-courses → error envelope for professor", async () => {
  const res = await req("get", "/courses/my-courses", {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses/:id → 200 { course + enrolled_students }", async () => {
  const res = await req("get", `/courses/${state.courseId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  okData(z.strictObject({ course: CourseDetail })).parse(res.body);
});

test("GET /courses/:id → error envelope for missing course", async () => {
  const res = await req("get", `/courses/${RANDOM_UUID}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses/:id → 200 for enrolled student", async () => {
  const res = await req("get", `/courses/${state.courseId}`, {
    token: state.tok.student,
  });
  assert.equal(res.status, 200);
  okData(z.strictObject({ course: CourseDetail })).parse(res.body);
});

test("GET /courses/:id → error envelope for non-enrolled student", async () => {
  const courseId = await makeCourse();
  const res = await req("get", `/courses/${courseId}`, {
    token: state.tok.student,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses/:id → error envelope for non-owner professor", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const res = await req("get", `/courses/${courseId}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /courses/:id/enroll → 200 { enrollments }", async () => {
  const student = await makeStudent();
  const res = await req("post", `/courses/${state.courseId}/enroll`, {
    token: state.tok.prof,
    body: { studentIds: [student.id] },
  });
  assert.equal(res.status, 200);
  okMsgData(z.strictObject({ enrollments: z.array(EnrollmentRow) })).parse(
    res.body,
  );
});

test("POST /courses/:id/enroll → error envelope for empty studentIds", async () => {
  const res = await req("post", `/courses/${state.courseId}/enroll`, {
    token: state.tok.prof,
    body: { studentIds: [] },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /courses/:id/enroll → error envelope for non-owner professor", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const student = await makeStudent();
  const res = await req("post", `/courses/${courseId}/enroll`, {
    token: state.tok.prof,
    body: { studentIds: [student.id] },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses/:id/students → 200 { students }", async () => {
  const res = await req("get", `/courses/${state.courseId}/students`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  okData(z.strictObject({ students: z.array(CourseStudent) })).parse(res.body);
});

test("GET /courses/:id/students → error envelope for student role", async () => {
  const res = await req("get", `/courses/${state.courseId}/students`, {
    token: state.tok.student,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /courses/:id/students → error envelope for non-owner professor", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const res = await req("get", `/courses/${courseId}/students`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("PATCH /courses/:id → 200 { course }", async () => {
  const courseId = await makeCourse();
  const res = await req("patch", `/courses/${courseId}`, {
    token: state.tok.prof,
    body: { courseName: "Renamed Course", semester: "Spring" },
  });
  assert.equal(res.status, 200);
  okMsgData(z.strictObject({ course: CourseRow })).parse(res.body);
});

test("PATCH /courses/:id → error envelope for empty body", async () => {
  const res = await req("patch", `/courses/${state.courseId}`, {
    token: state.tok.prof,
    body: {},
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("PATCH /courses/:id → error envelope for non-owner professor", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const res = await req("patch", `/courses/${courseId}`, {
    token: state.tok.prof,
    body: { courseName: "Hijack" },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("PATCH /courses/:id → error envelope for duplicate course code", async () => {
  const takenCode = uniq("DUP");
  const created = await req("post", "/courses", {
    token: state.tok.prof,
    body: {
      courseCode: takenCode,
      courseName: "Holder",
      semester: "Fall",
      academicYear: "2025-2026",
    },
  });
  assert.equal(created.status, 201);
  const courseId = await makeCourse();
  const res = await req("patch", `/courses/${courseId}`, {
    token: state.tok.prof,
    body: { courseCode: takenCode },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("DELETE /courses/:id → 200 { success, message }", async () => {
  const courseId = await makeCourse();
  const res = await req("delete", `/courses/${courseId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  z.strictObject({ success: z.literal(true), message: z.string() }).parse(
    res.body,
  );
});

test("DELETE /courses/:id → error envelope for missing course", async () => {
  const res = await req("delete", `/courses/${RANDOM_UUID}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});
