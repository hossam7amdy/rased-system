export type UserRole = "professor" | "student" | "admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface User extends AuthenticatedUser {
  password_hash: string;
}
