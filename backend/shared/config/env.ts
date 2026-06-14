import { z } from "zod";

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),

    PORT: z.coerce.number().int().positive().default(5000),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),

    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().min(1).default("24h"),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),

    QR_SECRET: z.string().min(32),
    QR_ROTATION_MS: z.coerce.number().int().positive().default(8000),
    QR_VALIDITY_MS: z.coerce.number().int().positive().default(20000),

    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).default(0),

    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
  })
  .refine((env) => env.QR_VALIDITY_MS >= env.QR_ROTATION_MS, {
    error:
      "QR_VALIDITY_MS must be >= QR_ROTATION_MS; otherwise tokens expire before the next rotation.",
    path: ["QR_VALIDITY_MS"],
  });

export type Env = z.infer<typeof EnvSchema>;
