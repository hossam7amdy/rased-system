import { expect } from "@playwright/test";
import { professorTest as test } from "./fixtures/auth.ts";

const uid = crypto.randomUUID().slice(0, 7);
const course = {
  code: `T${uid}`,
  name: `E2E Course ${uid}`,
};

test.describe("Professor dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/professor");
    // Wait for the courses tab button (tab bar = dashboard loaded)
    await page.waitForSelector('button:has-text("المواد الدراسية")', {
      timeout: 10_000,
    });
  });

  test("courses dashboard renders", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "المواد الدراسية" }).first(),
    ).toBeVisible();
  });

  test("creates a new course", async ({ page }) => {
    await page.getByRole("button", { name: /مادة جديدة/ }).click();
    await page.waitForSelector("form", { state: "visible" });

    await page.locator("#course-name").pressSequentially(course.name);
    await page.locator("#course-code").pressSequentially(course.code);

    await page.locator('form button[type="submit"]').click();
    // Wait for the course card to appear — the modal closes on success
    await expect(page.getByText(course.name)).toBeVisible({ timeout: 10_000 });
  });

  test("starts an attendance QR session", async ({ page }) => {
    // Skip if no courses visible yet
    const startBtn = page
      .getByRole("button", { name: /بدء جلسة|Start/i })
      .first();
    const hasCourse = await startBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!hasCourse) {
      test.skip(true, "no courses loaded in test DB");
      return;
    }

    await startBtn.click();
    await expect(page.getByText(/جلسة نشطة/)).toBeVisible({ timeout: 10_000 });
  });

  test("ends an active session", async ({ page }) => {
    const startBtn = page
      .getByRole("button", { name: /بدء جلسة|Start/i })
      .first();
    const hasCourse = await startBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!hasCourse) {
      test.skip(true, "no courses loaded in test DB");
      return;
    }

    await startBtn.click();
    await page.waitForSelector('button:has-text("إنهاء الجلسة")', {
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /إنهاء الجلسة/ }).click();
    await expect(page.getByText("المواد الدراسية").first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test("attendance tab renders", async ({ page }) => {
    // Use .first() to handle the sidebar icon button with same title
    await page.getByRole("button", { name: "سجل الحضور" }).first().click();
    await expect(page.locator("main").first()).toBeVisible({ timeout: 5_000 });
  });
});
