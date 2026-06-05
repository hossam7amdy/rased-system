import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Per-test route tables consulted by the axios mock below. Keys are matched
// with String.includes against the request URL.
const routes: { get: Map<string, unknown>; post: Map<string, unknown> } = {
	get: new Map(),
	post: new Map(),
};

vi.mock("axios", () => {
	const resolve = (method: "get" | "post") => (url: string) => {
		for (const [key, value] of routes[method]) {
			if (url.includes(key)) return Promise.resolve(value);
		}
		return Promise.reject({
			response: { status: 404, data: { message: `no mock for ${url}` } },
		});
	};
	const instance = {
		defaults: {
			baseURL: "",
			headers: { common: {} as Record<string, string> },
		},
		get: vi.fn((url: string) => resolve("get")(url)),
		post: vi.fn((url: string) => resolve("post")(url)),
		patch: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
		delete: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
	};
	return { default: instance };
});

// App reads from these at module load; import after the mock is registered.
const { default: App } = await import("./App.jsx");

const profile = (role: string) => ({
	data: { success: true, data: { user: { id: 1, full_name: "Test", role } } },
});

beforeEach(() => {
	routes.get.clear();
	routes.post.clear();
	localStorage.clear();
	window.history.pushState({}, "", "/");
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("App smoke — routing & auth guard", () => {
	test("unauthenticated visitor lands on the login page", async () => {
		render(<App />);
		expect(
			await screen.findByRole("heading", { name: "تسجيل الدخول" }),
		).toBeInTheDocument();
	});

	test("ProtectedRoute blocks a student from an admin route", async () => {
		localStorage.setItem("token", "fake");
		routes.get.set("/auth/profile", profile("student"));
		window.history.pushState({}, "", "/admin");

		render(<App />);

		// Wrong role -> redirected to "/" -> redirected to /login.
		expect(
			await screen.findByRole("heading", { name: "تسجيل الدخول" }),
		).toBeInTheDocument();
	});

	test("ProtectedRoute admits the matching role to its dashboard", async () => {
		localStorage.setItem("token", "fake");
		routes.get.set("/auth/profile", profile("student"));
		routes.get.set("/courses/my-courses", {
			data: { success: true, courses: [] },
		});
		window.history.pushState({}, "", "/student");

		render(<App />);

		expect(
			await screen.findByRole("heading", { name: "تسجيل الحضور" }),
		).toBeInTheDocument();
	});

	test("login form submits credentials to the auth endpoint", async () => {
		const axios = (await import("axios")).default;
		routes.post.set("/auth/login", {
			data: {
				success: true,
				data: {
					accessToken: "tok",
					user: { id: 1, full_name: "Test", role: "student" },
				},
			},
		});
		routes.get.set("/courses/my-courses", {
			data: { success: true, courses: [] },
		});

		render(<App />);
		const heading = await screen.findByRole("heading", {
			name: "تسجيل الدخول",
		});
		expect(heading).toBeInTheDocument();

		const inputs = document.querySelectorAll("input");
		const { default: userEvent } = await import("@testing-library/user-event");
		const user = userEvent.setup();
		await user.type(inputs[0], "a@b.com");
		await user.type(inputs[1], "pw");
		await user.click(screen.getByRole("button", { name: /دخول إلى النظام/ }));

		await waitFor(() => {
			expect(axios.post).toHaveBeenCalledWith(
				"/auth/login",
				expect.objectContaining({ email: "a@b.com", password: "pw" }),
			);
		});
	});
});
