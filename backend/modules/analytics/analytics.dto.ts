import type { Course } from "../courses/course.model.ts";

export interface CourseStatisticsDto {
  total_sessions: number;
  total_students: number;
  total_attendance: number;
  average_attendance: number;
}

export interface AttendanceTrendRow {
  id: string;
  session_name: string;
  session_date: Date;
  attendance_count: string;
}

export interface AtRiskStudentRow {
  id: string;
  full_name: string;
  student_id: string | null;
  total_sessions: string;
  attended_sessions: string;
  attendance_percentage: string | null;
}

export interface CourseAnalyticsDto {
  course: Course;
  statistics: CourseStatisticsDto;
  attendance_trend: AttendanceTrendRow[];
  at_risk_students: AtRiskStudentRow[];
}

export interface StudentStatisticsDto {
  enrolled_courses: number;
  total_sessions: number;
  attended_sessions: number;
  overall_percentage: number;
}

export interface StudentCourseAttendanceRow {
  course_name: string;
  course_code: string;
  total_sessions: string;
  attended_sessions: string;
  attendance_percentage: string | null;
}

export interface RecentAttendanceRow {
  course_name: string;
  session_name: string;
  session_date: Date;
  scanned_at: Date;
}

export interface StudentAnalyticsDto {
  statistics: StudentStatisticsDto;
  courses: StudentCourseAttendanceRow[];
  recent_attendance: RecentAttendanceRow[];
}

export interface SessionExportRow {
  student_id: string;
  full_name: string;
  email: string;
  scanned_at: Date | null;
  is_manual_override: boolean;
}

export interface CourseExportRow {
  student_id: string;
  full_name: string;
  total_sessions: string;
  attended_sessions: string;
  percentage: string;
}

export interface SessionExportResult {
  course: Course;
  rows: SessionExportRow[];
}

export interface CourseExportResult {
  course: Course;
  rows: CourseExportRow[];
}
