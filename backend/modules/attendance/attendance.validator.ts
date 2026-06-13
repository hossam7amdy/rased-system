import z from "zod";

export const CreateSessionSchema = z.strictObject({
  courseId: z.uuid("معرف المادة مطلوب."),
  sessionName: z.string().min(1).max(255).optional(),
  sessionDate: z.string().optional(),
});

export const ScanQRSchema = z.strictObject({
  token: z.string().min(1),
  courseId: z.uuid().optional(),
});

export const ManualOverrideSchema = z.strictObject({
  sessionId: z.uuid(),
  studentId: z.uuid(),
  reason: z.string().max(255).optional(),
});
