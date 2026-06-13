import type { output } from "zod";
import type { AuthenticatedUser } from "./auth.model.ts";
import type { LoginSchema, RegisterSchema } from "./auth.validator.ts";

export type LoginDto = output<typeof LoginSchema>;
export type RegisterDto = output<typeof RegisterSchema>;

export interface LoginResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}
