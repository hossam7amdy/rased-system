import { expect, test } from "@playwright/test";
import { CREDS } from "./global-setup";

async function login(
	page: import("@playwright/test").Page,
	email: string,
	password: string,
) {
	await page.goto("/login");
	await page.fill("#login-email", email);
	await page.fill("#login-password", password);
	await page.click('button[type="submit"]');
}

test.describe("Login flow", () => {
	for (const [role, creds] of Object.entries(CREDS)) {
		test(`${role} logs in and lands on correct dashboard`, async ({ page }) => {
			await login(page, creds.email, creds.password);
			await page.waitForURL(`**${creds.path}`, { timeout: 10_000 });
		});
	}

	test("wrong password shows error message", async ({ page }) => {
		await login(page, CREDS.admin.email, "wrongpassword");
		// Assert on the visible error text, not on CSS class names
		await expect(
			page.getByText(/خطأ في البريد أو كلمة المرور/),
		).toBeVisible({ timeout: 5_000 });
	});

	test("unauthenticated visit to /admin redirects to /login", async ({
		page,
	}) => {
		await page.goto("/admin");
		await page.waitForURL("**/login", { timeout: 5_000 });
	});

	test("logout clears session and redirects to /login", async ({ page }) => {
		await login(page, CREDS.admin.email, CREDS.admin.password);
		await page.waitForURL("**/admin", { timeout: 10_000 });

		await page.getByRole("button", { name: "خروج" }).click();
		await page.waitForURL("**/login", { timeout: 5_000 });
	});
});
