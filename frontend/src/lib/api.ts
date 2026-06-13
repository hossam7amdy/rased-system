import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { bearer, getToken } from "./auth-token.js";
import { ApiError, unwrap } from "./response.js";
import type {
  Course,
  CourseAnalytics,
  EnrollResult,
  ImportResult,
  ImportRow,
  LoginResult,
  QrToken,
  Role,
  SessionSummary,
  Student,
  User,
} from "./types.ts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const client = axios.create({ baseURL: `${API_BASE_URL}/api` });

// Request: attach the bearer token from the single token source.
client.interceptors.request.use((config) => {
  const header = bearer(getToken());
  if (header) {
    config.headers.Authorization = header;
  }
  return config;
});

// Response: normalize errors into ApiError carrying the server message + status.
// Success envelopes are unwrapped per-endpoint below (not here) because the
// enroll endpoints return their whole envelope to the UI.
client.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string }>) => {
    const status = err.response?.status;
    const message = err.response?.data?.message ?? err.message;
    return Promise.reject(new ApiError(message, status));
  },
);

/** Unwrap a standard { success, data } envelope into its typed payload. */
async function payload<T>(promise: Promise<{ data: unknown }>): Promise<T> {
  const res = await promise;
  return unwrap(res.data) as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    payload<LoginResult>(client.post("/auth/login", { email, password })),
  profile: () => payload<{ user: User }>(client.get("/auth/profile")),
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    role: Role;
    studentId?: string;
  }) => payload<{ user: User }>(client.post("/auth/register", input)),
};

// ── Courses ──────────────────────────────────────────────────────────────────
export const coursesApi = {
  list: () => payload<{ courses: Course[] }>(client.get("/courses/")),
  myCourses: () =>
    payload<{ courses: Course[] }>(client.get("/courses/my-courses")),
  create: (input: {
    courseCode: string;
    courseName: string;
    semester: string;
    academicYear: string;
  }) => payload<{ course: Course }>(client.post("/courses", input)),
  update: (
    courseId: string,
    input: {
      courseCode: string;
      courseName: string;
      semester: string;
      academicYear: string;
    },
  ) => payload<{ course: Course }>(client.patch(`/courses/${courseId}`, input)),
  remove: (courseId: string) =>
    payload<unknown>(client.delete(`/courses/${courseId}`)),
};

// ── Attendance ───────────────────────────────────────────────────────────────
export const attendanceApi = {
  currentQr: (courseId: string) =>
    payload<QrToken>(client.get(`/attendance/current-qr/${courseId}`)),
  session: (sessionId: string) =>
    payload<{ records: import("./types").AttendanceRecord[] }>(
      client.get(`/attendance/sessions/${sessionId}`),
    ),
  startSession: (input: {
    courseId: string;
    sessionName: string;
    sessionDate: string;
  }) =>
    payload<{ session: SessionSummary }>(
      client.post("/attendance/sessions", input),
    ),
  endSession: (sessionId: string) =>
    payload<unknown>(client.patch(`/attendance/sessions/${sessionId}/end`)),
  scan: (token: string, courseId: string) =>
    payload<unknown>(client.post("/attendance/scan", { token, courseId })),
};

// ── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  course: (courseId: string) =>
    payload<CourseAnalytics>(client.get(`/analytics/course/${courseId}`)),
  /** Returns a Blob (xlsx). */
  export: async (params: { courseId: string; sessionId?: string }) => {
    const res = await client.get("/analytics/export", {
      params,
      responseType: "blob",
    } satisfies AxiosRequestConfig);
    return res.data as Blob;
  },
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  users: () => payload<{ users: User[] }>(client.get("/admin/users")),
  students: () =>
    payload<{ students: Student[] }>(client.get("/admin/students")),
  courses: () => payload<{ courses: Course[] }>(client.get("/admin/courses")),
  deleteUser: (id: number) =>
    payload<unknown>(client.delete(`/admin/users/${id}`)),
  // Enroll endpoints return their full result envelope to the UI (not unwrapped).
  enrollBulk: async (studentIds: string[], courseIds: string[]) => {
    const res = await client.post("/admin/enroll-bulk", {
      studentIds,
      courseIds,
    });
    return res.data as EnrollResult;
  },
  enrollImport: async (rows: ImportRow[]) => {
    const res = await client.post("/admin/enroll-import", { rows });
    return res.data as ImportResult;
  },
};
