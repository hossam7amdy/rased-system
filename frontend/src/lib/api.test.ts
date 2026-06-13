import { afterEach, describe, expect, test, vi } from "vitest";

// Control the axios instance that api.ts creates at import time.
const h = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock("axios", () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      ...h,
    }),
  },
}));

const api = await import("./api.ts");

afterEach(() => {
  vi.clearAllMocks();
});

describe("api layer — envelope handling", () => {
  test("login unwraps the standard { success, data } envelope", async () => {
    h.post.mockResolvedValue({
      data: { success: true, data: { accessToken: "tok", user: { id: 1 } } },
    });
    const result = await api.authApi.login("a@b.com", "pw");
    expect(result).toEqual({ accessToken: "tok", user: { id: 1 } });
    expect(h.post).toHaveBeenCalledWith("/auth/login", {
      email: "a@b.com",
      password: "pw",
    });
  });

  test("myCourses unwraps a sibling payload (no data field)", async () => {
    h.get.mockResolvedValue({
      data: { success: true, courses: [{ id: 1 }] },
    });
    expect(await api.coursesApi.myCourses()).toEqual({ courses: [{ id: 1 }] });
  });

  test("enrollBulk returns the whole result envelope (not unwrapped)", async () => {
    h.post.mockResolvedValue({
      data: { success: true, errors: 0, enrolled: 3, message: "ok" },
    });
    expect(await api.adminApi.enrollBulk([1], ["2"])).toEqual({
      success: true,
      errors: 0,
      enrolled: 3,
      message: "ok",
    });
  });

  test("export requests a blob response type", async () => {
    h.get.mockResolvedValue({ data: new Blob(["x"]) });
    await api.analyticsApi.export({ courseId: "5" });
    expect(h.get).toHaveBeenCalledWith(
      "/analytics/export",
      expect.objectContaining({
        responseType: "blob",
        params: { courseId: "5" },
      }),
    );
  });
});
