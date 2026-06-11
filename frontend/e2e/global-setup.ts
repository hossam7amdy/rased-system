import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type FullConfig } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FRONTEND =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
export const API_BASE =
  process.env.PLAYWRIGHT_API_BASE ?? "http://localhost:5000/api";

export const CREDS = {
  admin: { email: "admin@rased.edu", password: "admin123", path: "/admin" },
  professor: {
    email: "prof@rased.edu",
    password: "prof123",
    path: "/professor",
  },
  student: { email: "stud@rased.edu", password: "stud123", path: "/student" },
};

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
  // Smoke-check backend is reachable and credentials are valid
  const ping = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: CREDS.admin.email,
      password: CREDS.admin.password,
    }),
  });
  const pingJson = await ping.json();
  if (!ping.ok || !pingJson?.data?.accessToken) {
    throw new Error(
      `Admin login failed — is the backend running at ${API_BASE}?`,
    );
  }

  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });

  // Save browser storage states (JWT in localStorage) for each role — run in parallel
  await Promise.all([
    saveAuthState(
      CREDS.admin.email,
      CREDS.admin.password,
      CREDS.admin.path,
      path.join(authDir, "admin.json"),
    ),
    saveAuthState(
      CREDS.professor.email,
      CREDS.professor.password,
      CREDS.professor.path,
      path.join(authDir, "professor.json"),
    ),
    saveAuthState(
      CREDS.student.email,
      CREDS.student.password,
      CREDS.student.path,
      path.join(authDir, "student.json"),
    ),
  ]);
}
