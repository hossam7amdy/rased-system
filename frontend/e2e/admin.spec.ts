import { expect } from "@playwright/test";
import { adminTest as test } from "./fixtures/auth.ts";

const profUid = crypto.randomUUID().slice(0, 8);
const studUid = crypto.randomUUID().slice(0, 8);
const newProfessor = {
  fullName: `E2E Prof ${profUid}`,
  email: `e2e.prof.${profUid}@test.com`,
  password: "Test@123456",
};
const newStudent = {
  fullName: `E2E Student ${studUid}`,
  email: `e2e.stu.${studUid}@test.com`,
  password: "Test@123456",
  studentId: `S${studUid}`,
};
const delUid = crypto.randomUUID().slice(0, 8);
const deletableStudent = {
  fullName: `E2E Delete ${delUid}`,
  email: `e2e.del.${delUid}@test.com`,
  password: "Test@123456",
  studentId: `D${delUid}`,
};

test.describe("Admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("tbody tr", {
      timeout: 10_000,
      state: "visible",
    });
  });

  test("user list renders with at least one user", async ({ page }) => {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("creates a professor account", async ({ page }) => {
    await page.getByRole("button", { name: /إضافة مستخدم/i }).click();
    await page.waitForSelector("form", { state: "visible" });

    await page.getByLabel(/الاسم الكامل/i).fill(newProfessor.fullName);
    await page.getByLabel(/البريد/i).fill(newProfessor.email);
    await page.getByLabel(/كلمة المرور/i).fill(newProfessor.password);

    const roleSelect = page.locator("form select");
    await expect(roleSelect).toBeVisible();
    await roleSelect.selectOption("professor");

    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(newProfessor.email)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("creates a student account", async ({ page }) => {
    await page.getByRole("button", { name: /إضافة مستخدم/i }).click();
    await page.waitForSelector("form", { state: "visible" });

    await page.getByLabel(/الاسم الكامل/i).fill(newStudent.fullName);
    await page.getByLabel(/البريد/i).fill(newStudent.email);
    await page.getByLabel(/كلمة المرور/i).fill(newStudent.password);

    const roleSelect = page.locator("form select");
    await expect(roleSelect).toBeVisible();
    await roleSelect.selectOption("student");

    const studentIdField = page.getByLabel(/الرقم الجامعي/i);
    await expect(studentIdField).toBeVisible();
    await studentIdField.fill(newStudent.studentId);

    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(newStudent.email)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("creates then deletes a user", async ({ page }) => {
    // Create a disposable student.
    await page.getByRole("button", { name: /إضافة مستخدم/i }).click();
    await page.waitForSelector("form", { state: "visible" });
    await page.getByLabel(/الاسم الكامل/i).fill(deletableStudent.fullName);
    await page.getByLabel(/البريد/i).fill(deletableStudent.email);
    await page.getByLabel(/كلمة المرور/i).fill(deletableStudent.password);
    await page.locator("form select").selectOption("student");
    await page.getByLabel(/الرقم الجامعي/i).fill(deletableStudent.studentId);
    await page.locator('form button[type="submit"]').click();

    const row = page.locator("tbody tr", { hasText: deletableStudent.email });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Open the confirm modal from the row's delete button.
    await row.getByTitle("حذف المستخدم").click();
    const confirm = page.getByRole("button", { name: "حذف نهائي" });
    await expect(confirm).toBeVisible();
    await confirm.click();

    // Row gone + success toast.
    await expect(page.getByText(deletableStudent.email)).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("cannot delete own admin account", async ({ page }) => {
    // The logged-in admin's own row carries the self-guard title, proving the
    // disable is from isSelf (not last-admin).
    const ownRow = page.locator("tbody tr", { hasText: "admin@rased.edu" });
    const btn = ownRow.getByTitle("لا يمكنك حذف حسابك");
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test("enrollment tab is accessible", async ({ page }) => {
    await page.getByRole("button", { name: /ربط الطلاب/i }).click();
    // Assert unique enrollment panel content, not the nav button text
    await expect(page.getByText("اختر طلاباً ومواداً للربط")).toBeVisible({
      timeout: 5_000,
    });
  });
});
