import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DynamicQRDisplay } from "./DynamicQRDisplay";

vi.mock("../../lib/api", () => ({
	attendanceApi: {
		currentQr: vi.fn().mockResolvedValue({ token: "tok", remainingSeconds: 3 }),
		session: vi.fn().mockResolvedValue({ records: [] }),
	},
}));

vi.mock("qrcode", () => ({
	default: {
		toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake"),
	},
}));

const course = {
	id: 1,
	course_code: "CS101",
	course_name: "Test Course",
	semester: "Fall",
	academic_year: "2025/2026",
};

describe("DynamicQRDisplay — timer", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	test("timer counts down to 0 and does not wrap back to 8", async () => {
		render(<DynamicQRDisplay course={course} sessionId={null} />);

		// Let the initial API fetch settle (sets timer to 3 from server)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});

		// Advance 10 more seconds — 10 ticks of the 1s interval
		// Timer: 3 → 2 → 1 → 0 → 0 → 0 ... (should hold at 0)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});

		// Should show 0, not reset back to 8
		expect(screen.queryAllByText(/^8$/)).toHaveLength(0);
	});

	test("timer display is visible on render", async () => {
		render(<DynamicQRDisplay course={course} sessionId={null} />);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		expect(document.body.textContent).toMatch(/\d/);
	});
});
