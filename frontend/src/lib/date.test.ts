import { describe, expect, test } from "vitest";
import { localISODate } from "./date";

describe("localISODate", () => {
	test("returns YYYY-MM-DD format", () => {
		expect(localISODate(new Date(2025, 0, 15))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test("uses local calendar date — Jan 15 at 00:30 local stays Jan 15", () => {
		// new Date(y, m, d, h) is always local time — safe regardless of TZ
		expect(localISODate(new Date(2025, 0, 15, 0, 30))).toBe("2025-01-15");
	});

	test("does not use UTC — toISOString would shift back a day in UTC+2/+3", () => {
		// Simulate a date that is midnight Jan 15 local.
		// toISOString() in UTC+3 would return "...T21:00:00.000Z" (Jan 14 UTC).
		// localISODate must return "2025-01-15".
		const midnightLocal = new Date(2025, 0, 15, 0, 0, 0);
		expect(localISODate(midnightLocal)).toBe("2025-01-15");
		// Contrast: toISOString splits by "T" and takes date part in UTC
		// which may differ from local date. We just assert our fn is correct.
	});

	test("handles end-of-month and end-of-year", () => {
		expect(localISODate(new Date(2025, 1, 28))).toBe("2025-02-28");
		expect(localISODate(new Date(2025, 11, 31))).toBe("2025-12-31");
	});
});
