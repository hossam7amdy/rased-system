import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { req, state, uniq } from "./helpers.ts";
import {
  Err,
  Health,
  LoginUser,
  okData,
  okMsgData,
  ProfileUser,
} from "./schemas.ts";
import { PASSWORD } from "./setup.ts";

test("POST /auth/login → 200 { user(+updated_at), accessToken, refreshToken }", async () => {
  const res = await req("post", "/auth/login", {
    body: { email: state.creds.prof.email, password: PASSWORD },
  });
  assert.equal(res.status, 200);
  okMsgData(
    z.strictObject({
      user: LoginUser,
      accessToken: z.string(),
      refreshToken: z.string(),
    }),
  ).parse(res.body);
});

test("POST /auth/login → error envelope on bad credentials", async () => {
  const res = await req("post", "/auth/login", {
    body: { email: state.creds.prof.email, password: "wrong" },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("POST /auth/register → 201 { user } (no updated_at)", async () => {
  const res = await req("post", "/auth/register", {
    token: state.tok.admin,
    body: {
      email: `${uniq("reg")}@rased.edu`,
      password: PASSWORD,
      role: "professor",
      fullName: "Registered Prof",
    },
  });
  assert.equal(res.status, 201);
  okMsgData(z.strictObject({ user: ProfileUser })).parse(res.body);
});

test("POST /auth/register → error envelope without auth", async () => {
  const res = await req("post", "/auth/register", {
    body: { email: "x@y.z", password: "p", role: "professor", fullName: "N" },
  });
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /auth/profile → 200 { user }", async () => {
  const res = await req("get", "/auth/profile", { token: state.tok.prof });
  assert.equal(res.status, 200);
  okData(z.strictObject({ user: ProfileUser })).parse(res.body);
});

test("GET /auth/profile → error envelope without auth", async () => {
  const res = await req("get", "/auth/profile");
  assert.ok(res.status >= 400);
  Err.parse(res.body);
});

test("GET /health → 200 { status, timestamp }", async () => {
  const res = await req("get", "/health");
  assert.equal(res.status, 200);
  Health.parse(res.body);
});
