export interface AttendanceSession {
  id: string;
  course_id: string;
  session_name: string;
  session_date: string;
  start_time: Date;
  end_time: Date | null;
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  course_id: string;
  student_id: string;
  scanned_at: Date;
  status: string;
  is_manual_override: boolean;
  override_reason: string | null;
}
