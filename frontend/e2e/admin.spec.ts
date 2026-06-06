import { expect } from "@playwright/test";
import { adminTest as test } from "./fixtures/auth";

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

test.describe("Admin dashboard", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/admin");
		await page.waitForSelector("tbody tr", { timeout: 10_000, state: "visible" });
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
		await expect(page.getByText(newProfessor.email)).toBeVisible({ timeout: 10_000 });
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
		await expect(page.getByText(newStudent.email)).toBeVisible({ timeout: 10_000 });
	});

	test("enrollment tab is accessible", async ({ page }) => {
		await page.getByRole("button", { name: /ربط الطلاب/i }).click();
		// Assert unique enrollment panel content, not the nav button text
		await expect(page.getByText("اختر طلاباً ومواداً للربط")).toBeVisible({ timeout: 5_000 });
	});
});
