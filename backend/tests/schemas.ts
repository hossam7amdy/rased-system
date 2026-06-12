import { z } from "zod";

// Schemas lock each endpoint's CURRENT response shape. ts = ISO-8601 UTC datetime
// (pg TIMESTAMP & DATE both serialize that way); countStr = digit-string (pg bigint
// COUNT, unparsed); strictObject rejects unexpected fields.
// TODO: envelope is inconsistent (data-wrapped vs sibling vs flat) —
//   normalize controllers later with this suite as safety net.
// TODO: Socket.io events (session_started, student_attended) uncovered.

const uuid = z.uuid();
const ts = z.iso.datetime();
const countStr = z.string().regex(/^\d+$/); // pg bigint COUNT, unparsed
const role = z.enum(["admin", "professor", "student"]);

export const Err = z.strictObject({
  success: z.literal(false),
  message: z.string(),
});

export const okData = <T extends z.ZodTypeAny>(data: T) =>
  z.strictObject({ success: z.literal(true), data });

export const okMsgData = <T extends z.ZodTypeAny>(data: T) =>
  z.strictObject({ success: z.literal(true), message: z.string(), data });

// login: SELECT * minus password_hash → has updated_at
export const LoginUser = z.strictObject({
  id: uuid,
  email: z.email(),
  role,
  full_name: z.string(),
  student_id: z.string().nullable(),
  created_at: ts,
  updated_at: ts,
});

// register / getProfile / admin users: no updated_at
export const ProfileUser = z.strictObject({
  id: uuid,
  email: z.email(),
  role,
  full_name: z.string(),
  student_id: z.string().nullable(),
  created_at: ts,
});

export const AdminUser = ProfileUser;

export const AdminStudent = z.strictObject({
  id: uuid,
  full_name: z.string(),
  student_id: z.string().nullable(),
  email: z.email(),
  created_at: ts,
});

export const AdminCourse = z.strictObject({
  id: uuid,
  course_code: z.string(),
  course_name: z.string(),
  semester: z.string(),
  academic_year: z.string(),
  created_at: ts,
  professor_name: z.string(),
});

export const CourseRow = z.strictObject({
  id: uuid,
  course_code: z.string(),
  course_name: z.string(),
  professor_id: uuid,
  semester: z.string(),
  academic_year: z.string(),
  created_at: ts,
});

// GET /courses (professor): counts unparsed → strings
export const ProfCourse = z.strictObject({
  id: uuid,
  course_code: z.string(),
  course_name: z.string(),
  professor_id: uuid,
  semester: z.string(),
  academic_year: z.string(),
  created_at: ts,
  student_count: countStr,
  session_count: countStr,
});

// GET /courses/my-courses (sibling envelope): counts parsed → numbers
export const StudentCourse = z.strictObject({
  id: uuid,
  course_name: z.string(),
  course_code: z.string(),
  professor_name: z.string(),
  total_sessions: z.number(),
  attended_sessions: z.number(),
  attendance_percentage: z.number(),
});

export const CourseDetail = z.strictObject({
  id: uuid,
  course_code: z.string(),
  course_name: z.string(),
  professor_id: uuid,
  semester: z.string(),
  academic_year: z.string(),
  created_at: ts,
  professor_name: z.string(),
  enrolled_students: z.number(),
});

export const CourseStudent = z.strictObject({
  id: uuid,
  full_name: z.string(),
  student_id: z.string().nullable(),
  email: z.email(),
  enrolled_at: ts,
  total_sessions: z.number(),
  attended_sessions: z.number(),
  attendance_percentage: z.number(),
  is_at_risk: z.boolean(),
});

export const EnrollmentRow = z.strictObject({
  id: uuid,
  course_id: uuid,
  student_id: uuid,
  enrolled_at: ts,
});

export const SessionRow = z.strictObject({
  id: uuid,
  course_id: uuid,
  session_name: z.string(),
  session_date: ts,
  start_time: ts,
  end_time: ts.nullable(),
  is_active: z.boolean(),
  created_at: ts,
});

export const ActiveSession = z.strictObject({
  id: uuid,
  session_name: z.string(),
  session_date: ts,
  course_name: z.string(),
  course_code: z.string(),
});

export const SessionAttendanceRecord = z.strictObject({
  id: uuid,
  scanned_at: ts,
  is_manual_override: z.boolean(),
  student_db_id: uuid,
  full_name: z.string(),
  university_id: z.string().nullable(),
  email: z.email(),
  total_attended: z.number(),
  total_sessions: z.number(),
  attendance_percentage: z.number(),
});

export const StudentAttendanceRecord = z.strictObject({
  id: uuid,
  session_id: uuid,
  course_id: uuid,
  student_id: uuid,
  scanned_at: ts,
  status: z.string(),
  is_manual_override: z.boolean(),
  override_reason: z.string().nullable(),
  session_name: z.string(),
  session_date: ts,
  course_name: z.string(),
  course_code: z.string(),
});

export const AttendanceRecordRow = z.strictObject({
  id: uuid,
  session_id: uuid,
  course_id: uuid,
  student_id: uuid,
  scanned_at: ts,
  status: z.string(),
  is_manual_override: z.boolean(),
  override_reason: z.string().nullable(),
});

export const ScanResult = z.strictObject({
  sessionId: uuid,
  courseId: z.string(),
  attendancePercentage: z.number(),
});

export const CurrentQR = z.strictObject({
  token: z.string(),
  remainingSeconds: z.number(),
});

export const CourseAnalytics = z.strictObject({
  course: CourseRow,
  statistics: z.strictObject({
    total_sessions: z.number(),
    total_students: z.number(),
    total_attendance: z.number(),
    average_attendance: z.number(),
  }),
  attendance_trend: z.array(
    z.strictObject({
      id: uuid,
      session_name: z.string(),
      session_date: ts,
      attendance_count: countStr,
    }),
  ),
  at_risk_students: z.array(
    z.strictObject({
      id: uuid,
      full_name: z.string(),
      student_id: z.string().nullable(),
      total_sessions: countStr,
      attended_sessions: countStr,
      attendance_percentage: z.string().nullable(),
    }),
  ),
});

export const StudentAnalytics = z.strictObject({
  statistics: z.strictObject({
    enrolled_courses: z.number(),
    total_sessions: z.number(),
    attended_sessions: z.number(),
    overall_percentage: z.number(),
  }),
  courses: z.array(
    z.strictObject({
      course_name: z.string(),
      course_code: z.string(),
      total_sessions: countStr,
      attended_sessions: countStr,
      attendance_percentage: z.string().nullable(),
    }),
  ),
  recent_attendance: z.array(
    z.strictObject({
      course_name: z.string(),
      session_name: z.string(),
      session_date: ts,
      scanned_at: ts,
    }),
  ),
});

// flat envelopes (no data wrapper)
export const BulkResult = z.strictObject({
  success: z.literal(true),
  message: z.string(),
  enrolled: z.number(),
  duplicates: z.number(),
  errors: z.number(),
});

export const ImportResult = z.strictObject({
  success: z.literal(true),
  message: z.string(),
  total: z.number(),
  enrolled: z.number(),
  duplicates: z.number(),
  errors: z.number(),
  details: z.array(
    z.strictObject({
      rowNum: z.number(),
      studentName: z.string(),
      studentId: z.string(),
      courseCode: z.string(),
      status: z.string(),
      message: z.string(),
    }),
  ),
});

export const Health = z.strictObject({
  status: z.literal("ok"),
  timestamp: z.string(),
});
