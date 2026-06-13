import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type FullConfig } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const API_BASE =
  process.env.PLAYWRIGHT_API_BASE ?? "http://localhost:5000/api";

const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@rased.edu",
  password: process.env.E2E_ADMIN_PASSWORD ?? "pass@WORD#123",
  path: "/admin",
};

export const CREDS = {
  admin: ADMIN,
  professor: {
    email: "prof@rased.edu",
    password: "prof123",
    fullName: "E2E Professor",
    path: "/professor",
  },
  student: {
    email: "stud@rased.edu",
    password: "stud123",
    fullName: "E2E Student",
    studentId: "E2E-STU-0001",
    path: "/student",
  },
};

const SEED_COURSE = {
  courseCode: "E2E-SEED-101",
  courseName: "E2E Seed Course",
  semester: "Fall",
  academicYear: "2025-2026",
};

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
}

async function api<T = Record<string, unknown>>(
  method: string,
  endpoint: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    body = {} as T;
  }
  return { ok: res.ok, status: res.status, body };
}

async function login(email: string, password: string): Promise<string> {
  const res = await api<{ data?: { accessToken?: string } }>(
    "POST",
    "/auth/login",
    { body: { email, password } },
  );
  const token = res.body?.data?.accessToken;
  if (!res.ok || !token) {
    throw new Error(
      `Login failed for ${email} (HTTP ${res.status}). ` +
        `If this is the bootstrap admin, make sure the backend ` +
        `is running at ${API_BASE}.`,
    );
  }
  return token;
}

async function ensureUser(
  adminToken: string,
  user: {
    email: string;
    password: string;
    fullName: string;
    role: "professor" | "student";
    studentId?: string;
  },
): Promise<void> {
  const res = await api("POST", "/auth/register", {
    token: adminToken,
    body: {
      email: user.email,
      password: user.password,
      fullName: user.fullName,
      role: user.role,
      studentId: user.studentId,
    },
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `Failed to create ${user.role} ${user.email} (HTTP ${res.status}): ` +
        JSON.stringify(res.body),
    );
  }
}

// Resolve a user's UUID by email from the admin user list.
async function findUserId(adminToken: string, email: string): Promise<string> {
  const res = await api<{
    data?: { users?: Array<{ id: string; email: string }> };
  }>("GET", "/admin/users", { token: adminToken });
  const user = res.body?.data?.users?.find((u) => u.email === email);
  if (!user) {
    throw new Error(`Could not resolve id for user ${email} after creation.`);
  }
  return user.id;
}

// Ensure the seed course exists and is owned by the e2e professor.
// Returns its UUID. Idempotent: reuses the existing course on re-runs.
async function ensureCourse(profToken: string): Promise<string> {
  const list = await api<{
    data?: { courses?: Array<{ id: string; course_code: string }> };
  }>("GET", "/courses", { token: profToken });
  const existing = list.body?.data?.courses?.find(
    (c) => c.course_code === SEED_COURSE.courseCode,
  );
  if (existing) return existing.id;

  const created = await api<{ data?: { course?: { id: string } } }>(
    "POST",
    "/courses",
    { token: profToken, body: SEED_COURSE },
  );
  const id = created.body?.data?.course?.id;
  if (!created.ok || !id) {
    throw new Error(
      `Failed to create seed course (HTTP ${created.status}): ` +
        JSON.stringify(created.body),
    );
  }
  return id;
}

// Enroll the student in the seed course. 409 = already enrolled = success.
async function ensureEnrollment(
  adminToken: string,
  studentId: string,
  courseId: string,
): Promise<void> {
  const res = await api("POST", "/admin/enroll", {
    token: adminToken,
    body: { studentId, courseId },
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `Failed to enroll student in seed course (HTTP ${res.status}): ` +
        JSON.stringify(res.body),
    );
  }
}

async function saveAuthState(
  email: string,
  password: string,
  expectedPath: string,
  outFile: string,
) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${FRONTEND}/login`);
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click('button[type="submit"]');
    // Verify redirect lands on the expected role dashboard, not an error page
    await page.waitForURL(`**${expectedPath}`, { timeout: 10_000 });

    await context.storageState({ path: outFile });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  // 1. Authenticate as the bootstrap admin.
  const adminToken = await login(ADMIN.email, ADMIN.password);

  // 2. Create the professor + student if they don't already exist.
  await ensureUser(adminToken, { ...CREDS.professor, role: "professor" });
  await ensureUser(adminToken, { ...CREDS.student, role: "student" });

  // 3. Create the seed course (owned by the professor) and enroll the student,
  //    so the professor/student specs have real data instead of skipping.
  const profToken = await login(
    CREDS.professor.email,
    CREDS.professor.password,
  );
  const courseId = await ensureCourse(profToken);
  const studentDbId = await findUserId(adminToken, CREDS.student.email);
  await ensureEnrollment(adminToken, studentDbId, courseId);

  // 4. Save browser storage states (JWT in localStorage) for each role.
  const authDir = join(__dirname, ".auth");
  mkdirSync(authDir, { recursive: true });

  await Promise.all([
    saveAuthState(
      CREDS.admin.email,
      CREDS.admin.password,
      CREDS.admin.path,
      join(authDir, "admin.json"),
    ),
    saveAuthState(
      CREDS.professor.email,
      CREDS.professor.password,
      CREDS.professor.path,
      join(authDir, "professor.json"),
    ),
    saveAuthState(
      CREDS.student.email,
      CREDS.student.password,
      CREDS.student.path,
      join(authDir, "student.json"),
    ),
  ]);
}
