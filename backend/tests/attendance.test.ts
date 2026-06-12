import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import qrTokenService from "../services/qrTokenService.ts";
import {
  enroll,
  makeCourse,
  makeProfessor,
  makeSession,
  makeStudent,
  req,
  state,
  tokenFor,
  uniq,
} from "./helpers.ts";
import {
  ActiveSession,
  AttendanceRecordRow,
  CurrentQR,
  Err,
  okData,
  okMsgData,
  ScanResult,
  SessionAttendanceRecord,
  SessionRow,
  StudentAttendanceRecord,
} from "./schemas.ts";

const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

test("GET /attendance/active-sessions → 200 { data: ActiveSession[] }", async () => {
  const res = await req("get", "/attendance/active-sessions", {
    token: state.tok.student,
  });
  assert.equal(res.status, 200);
  okData(z.array(ActiveSession)).parse(res.body);
});

test("GET /attendance/active-sessions → error envelope without auth", async () => {
  const res = await req("get", "/attendance/active-sessions");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/sessions → 201 { session }", async () => {
  const courseId = await makeCourse();
  const res = await req("post", "/attendance/sessions", {
    token: state.tok.prof,
    body: { courseId, sessionName: "Lecture 1" },
  });
  assert.equal(res.status, 201);
  okMsgData(z.strictObject({ session: SessionRow })).parse(res.body);
});

test("POST /attendance/sessions → error envelope without courseId", async () => {
  const res = await req("post", "/attendance/sessions", {
    token: state.tok.prof,
    body: {},
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/sessions → error envelope for non-owner professor", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const res = await req("post", "/attendance/sessions", {
    token: state.tok.prof,
    body: { courseId },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("PATCH /attendance/sessions/:id/end → 200 { success, message }", async () => {
  const courseId = await makeCourse();
  const sessionId = await makeSession(courseId);
  const res = await req("patch", `/attendance/sessions/${sessionId}/end`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  z.strictObject({ success: z.literal(true), message: z.string() }).parse(
    res.body,
  );
});

test("PATCH /attendance/sessions/:id/end → error envelope for foreign session", async () => {
  const res = await req("patch", `/attendance/sessions/${RANDOM_UUID}/end`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/scan → 200 { sessionId, courseId, attendancePercentage }", async () => {
  const courseId = await makeCourse();
  const student = await makeStudent();
  await enroll(student.id, courseId);
  await makeSession(courseId, true);
  const { token } = await qrTokenService.generateToken(courseId);

  const res = await req("post", "/attendance/scan", {
    token: tokenFor(student),
    body: { token },
  });
  assert.equal(res.status, 200);
  okMsgData(ScanResult).parse(res.body);
});

test("POST /attendance/scan → error envelope for invalid token", async () => {
  const res = await req("post", "/attendance/scan", {
    token: state.tok.student,
    body: { token: "garbage" },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/scan → error envelope for non-enrolled student", async () => {
  const courseId = await makeCourse();
  const student = await makeStudent();
  const { token } = await qrTokenService.generateToken(courseId);
  const res = await req("post", "/attendance/scan", {
    token: tokenFor(student),
    body: { token },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /attendance/current-qr/:courseId → 200 { token, remainingSeconds }", async () => {
  const courseId = await makeCourse();
  await qrTokenService.generateToken(courseId);
  const res = await req("get", `/attendance/current-qr/${courseId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  okData(CurrentQR).parse(res.body);
});

test("GET /attendance/current-qr/:courseId → error envelope when no active QR", async () => {
  const res = await req("get", `/attendance/current-qr/${RANDOM_UUID}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /attendance/sessions/:id → 200 { records }", async () => {
  const res = await req("get", `/attendance/sessions/${state.sessionId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  okData(z.strictObject({ records: z.array(SessionAttendanceRecord) })).parse(
    res.body,
  );
});

test("GET /attendance/sessions/:id → error envelope without auth", async () => {
  const res = await req("get", `/attendance/sessions/${state.sessionId}`);
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /attendance/student → 200 { attendance }", async () => {
  const res = await req("get", "/attendance/student", {
    token: state.tok.student,
  });
  assert.equal(res.status, 200);
  okData(
    z.strictObject({ attendance: z.array(StudentAttendanceRecord) }),
  ).parse(res.body);
});

test("GET /attendance/student → error envelope without auth", async () => {
  const res = await req("get", "/attendance/student");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/manual-override → 200 { record }", async () => {
  const courseId = await makeCourse();
  const sessionId = await makeSession(courseId);
  const student = await makeStudent();
  const res = await req("post", "/attendance/manual-override", {
    token: state.tok.prof,
    body: { sessionId, studentId: student.id, reason: uniq("reason") },
  });
  assert.equal(res.status, 200);
  okMsgData(z.strictObject({ record: AttendanceRecordRow })).parse(res.body);
});

test("POST /attendance/manual-override → error envelope without required fields", async () => {
  const res = await req("post", "/attendance/manual-override", {
    token: state.tok.prof,
    body: {},
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /attendance/manual-override → error envelope for foreign session", async () => {
  const other = await makeProfessor();
  const courseId = await makeCourse(other.id);
  const sessionId = await makeSession(courseId);
  const student = await makeStudent();
  const res = await req("post", "/attendance/manual-override", {
    token: state.tok.prof,
    body: { sessionId, studentId: student.id },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});
