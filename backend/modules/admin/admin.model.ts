export interface AdminStudentRow {
  id: string;
  full_name: string;
  student_id: string | null;
  email: string;
  created_at: Date;
}

export interface AdminCourseRow {
  id: string;
  course_code: string;
  course_name: string;
  semester: string;
  academic_year: string;
  created_at: Date;
  professor_name: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  full_name: string;
  student_id: string | null;
  created_at: Date;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: Date;
}

export interface ImportRow {
  rowNum?: number;
  studentId?: string;
  studentName?: string;
  courseCode?: string;
  courseName?: string;
}

export interface ImportDetail {
  rowNum: number;
  studentName: string;
  studentId: string;
  courseCode: string;
  status: string;
  message: string;
}
