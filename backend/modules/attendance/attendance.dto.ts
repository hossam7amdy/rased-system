import type { output } from "zod";
import type {
  AttendanceRecord,
  AttendanceSession,
} from "./attendance.model.ts";
import type {
  CreateSessionSchema,
  ManualOverrideSchema,
  ScanQRSchema,
} from "./attendance.validator.ts";

export type CreateSessionDto = output<typeof CreateSessionSchema> & {
  professorId: string;
};

export type ScanQRDto = output<typeof ScanQRSchema> & {
  studentId: string;
};

export type ManualOverrideDto = output<typeof ManualOverrideSchema> & {
  professorId: string;
};

export interface ActiveSessionDto {
  id: string;
  session_name: string;
  session_date: string;
  course_name: string;
  course_code: string;
}

export interface ScanResultDto {
  sessionId: string;
  courseId: string;
  attended: number;
  total: number;
  percentage: number;
}

export interface SessionAttendanceRecordDto {
  id: string;
  scanned_at: Date;
  is_manual_override: boolean;
  student_db_id: string;
  full_name: string;
  university_id: string | null;
  email: string;
  total_attended: number;
  total_sessions: number;
  attendance_percentage: number;
}

export interface CurrentQrDto {
  token: string;
  remainingSeconds: number;
}

export type { AttendanceRecord, AttendanceSession };
