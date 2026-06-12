import assert from "node:assert/strict";
import { test } from "node:test";
import { req, state } from "./helpers.ts";
import { CourseAnalytics, Err, okData, StudentAnalytics } from "./schemas.ts";

const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

test("GET /analytics/course/:id → 200 { course, statistics, trend, at_risk }", async () => {
  const res = await req("get", `/analytics/course/${state.courseId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  okData(CourseAnalytics).parse(res.body);
});

test("GET /analytics/course/:id → error envelope for non-owner", async () => {
  const res = await req("get", `/analytics/course/${RANDOM_UUID}`, {
    token: state.tok.prof,
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /analytics/student → 200 { statistics, courses, recent_attendance }", async () => {
  const res = await req("get", "/analytics/student", {
    token: state.tok.student,
  });
  assert.equal(res.status, 200);
  okData(StudentAnalytics).parse(res.body);
});

test("GET /analytics/student → error envelope without auth", async () => {
  const res = await req("get", "/analytics/student");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /analytics/export → 200 xlsx binary (content-type header)", async () => {
  const res = await req("get", `/analytics/export?courseId=${state.courseId}`, {
    token: state.tok.prof,
  });
  assert.equal(res.status, 200);
  assert.match(
    String(res.headers["content-type"]),
    /spreadsheetml\.sheet/,
    "export should return an xlsx content-type",
  );
  assert.match(String(res.headers["content-disposition"] ?? ""), /attachment/);
});

test("GET /analytics/export → error envelope without courseId", async () => {
  const res = await req("get", "/analytics/export", { token: state.tok.prof });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});
