import z from "zod";

export const ExportQuerySchema = z.object({
  courseId: z.uuid(),
  sessionId: z.uuid().optional(),
});
