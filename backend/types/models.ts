export type UserRole = "professor" | "student" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_id: string | null;
  created_at: Date;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  professor_id: string;
  created_at: Date;
}

export interface Enrollment {
  course_id: string;
  student_id: string;
  enrolled_at: Date;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  started_at: Date;
  ended_at: Date | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  scanned_at: Date;
}
