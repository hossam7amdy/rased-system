export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  professor_id: string;
  semester: string;
  academic_year: string;
  created_at: Date;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: Date;
}
