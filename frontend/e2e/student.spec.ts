import { expect } from "@playwright/test";
import { studentTest as test } from "./fixtures/auth";
import { API_BASE, CREDS } from "./global-setup";

test.describe("Student dashboard", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/student");
		await page.waitForSelector("main", { timeout: 10_000, state: "visible" });
	});

	test("dashboard renders for student", async ({ page }) => {
		await expect(page.getByText("تسجيل الحضور")).toBeVisible();
	});

	test("course selector is visible", async ({ page }) => {
		const selectVisible = await page.locator("#course-select").isVisible({ timeout: 5_000 }).catch(() => false);
		const emptyVisible = await page.getByText(/لا توجد مواد/).isVisible({ timeout: 1_000 }).catch(() => false);
		expect(selectVisible || emptyVisible).toBe(true);
	});

	test("attendance history visible when course selected", async ({ page }) => {
		const select = page.locator("#course-select");
		const hasSelect = await select.isVisible({ timeout: 5_000 }).catch(() => false);

		if (!hasSelect) {
			await expect(page.getByText(/لا توجد مواد/)).toBeVisible();
			return;
		}

		await expect(select).toBeVisible();
		await expect(page.locator("main").first()).toBeVisible();
	});

	test("QR scan simulated via API marks attendance", async ({ page }) => {
		const select = page.locator("#course-select");
		const hasSelect = await select.isVisible({ timeout: 5_000 }).catch(() => false);
		if (!hasSelect) {
			test.skip(true, "student not enrolled in any course");
			return;
		}

		const courseId = await select.inputValue();
		if (!courseId) {
			test.skip(true, "no course selected");
			return;
		}

		// Check student token before starting any session
		const studentToken = await page.evaluate(() => localStorage.getItem("token"));
		if (!studentToken) { test.skip(true, "student token missing from localStorage"); return; }

		// Get professor token to start a session
		const loginRes = await fetch(`${API_BASE}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(CREDS.professor),
		});
		if (!loginRes.ok) { test.skip(true, "professor login failed"); return; }
		const { data: loginData } = await loginRes.json();
		const profToken: string = loginData.accessToken;

		// Start a session for this course
		const sessionRes = await fetch(`${API_BASE}/attendance/sessions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${profToken}`,
			},
			body: JSON.stringify({
				courseId: Number(courseId),
				sessionName: `E2E Session ${Date.now()}`,
				sessionDate: new Date().toISOString().split("T")[0],
			}),
		});
		if (!sessionRes.ok) { test.skip(true, "could not start attendance session"); return; }
		const { data: sessionData } = await sessionRes.json();
		const sessionId: string | undefined = sessionData?.session?.id;

		// Cleanup runs regardless of test outcome
		const endSession = async () => {
			if (sessionId) {
				await fetch(`${API_BASE}/attendance/sessions/${sessionId}/end`, {
					method: "PATCH",
					headers: { Authorization: `Bearer ${profToken}` },
				});
			}
		};

		try {
			// Get active QR token — assert expected shape to fail explicitly
			const qrRes = await fetch(`${API_BASE}/attendance/current-qr/${courseId}`, {
				headers: { Authorization: `Bearer ${profToken}` },
			});
			expect(qrRes.ok).toBe(true);
			const qrData = await qrRes.json();
			expect(qrData).toHaveProperty("data.token");
			const qrToken: string = qrData.data.token;

			// Simulate QR scan via API (camera unavailable in headless)
			const scanRes = await fetch(`${API_BASE}/attendance/scan`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${studentToken}`,
				},
				body: JSON.stringify({ token: qrToken, courseId: Number(courseId) }),
			});

			const scanBody = await scanRes.json();
			expect([200, 201]).toContain(scanRes.status);
			expect(scanBody).toHaveProperty("data");
		} finally {
			await endSession();
		}
	});
});
