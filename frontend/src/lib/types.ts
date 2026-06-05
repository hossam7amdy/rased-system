// Domain types inferred from current backend usage. Refine as the backend
// contract is confirmed; these replace the implicit `any` shapes that hid the
// `res.data.data` vs `res.data` divergence.

export type Role = "admin" | "professor" | "student";

export interface User {
	id: number;
	full_name: string;
	email: string;
	role: Role;
	student_id?: string | null;
}

export interface Course {
	id: number;
	course_code: string;
	course_name: string;
	semester: string;
	academic_year: string;
	student_count?: number;
	session_count?: number;
}

export interface Student {
	id: number;
	full_name: string;
	student_id: string;
	email?: string;
}

/** A row in the analytics attendance_trend (also used as a session list item). */
export interface SessionSummary {
	id: number;
	session_name?: string;
	session_date?: string;
	attendance_count?: number;
}

export interface AttendanceRecord {
	id: number;
	full_name: string;
	university_id: string;
	scanned_at: string;
	attendance_percentage?: number;
	is_manual_override?: boolean;
}

export interface CourseStatistics {
	total_sessions: number;
	total_attendance: number;
	average_attendance: number;
}

export interface CourseAnalytics {
	statistics: CourseStatistics;
	attendance_trend: SessionSummary[];
}

export interface QrToken {
	token: string;
	remainingSeconds: number;
}

export interface LoginResult {
	accessToken: string;
	user: User;
}

/** Result envelopes returned (whole) by the enroll endpoints. */
export interface EnrollResult {
	success: boolean;
	message?: string;
	errors?: number;
	enrolled?: number;
	details?: unknown[];
}

export interface ImportRow {
	[key: string]: unknown;
}

export interface ImportResult {
	success: boolean;
	message?: string;
	details?: Array<{
		row?: number;
		status?: string;
		message?: string;
		[key: string]: unknown;
	}>;
}

/** Standard response envelope: { success, data, message }. */
export interface Envelope<T> {
	success: boolean;
	data?: T;
	message?: string;
}
