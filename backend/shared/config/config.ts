import { type FactoryProvider, InjectionToken } from "injectus";
import { prettifyError, treeifyError } from "zod";
import { type Env, EnvSchema } from "./env.ts";

export interface Config {
  env: Env["NODE_ENV"];
  logLevel: Env["LOG_LEVEL"];
  server: {
    port: number;
  };
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  qr: {
    secret: string;
    rotationMs: number;
    validityMs: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  } | null;
  cors: {
    origins: string[];
  };
}

function toConfig(env: Env): Config {
  const redis = env.REDIS_HOST
    ? {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        db: env.REDIS_DB,
        ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
      }
    : null;

  return {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    server: { port: env.PORT },
    db: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      name: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    jwt: {
      secret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    qr: {
      secret: env.QR_SECRET,
      rotationMs: env.QR_ROTATION_MS,
      validityMs: env.QR_VALIDITY_MS,
    },
    redis,
    cors: { origins: env.CORS_ORIGINS },
  };
}

export function loadConfig(source?: NodeJS.ProcessEnv): Config {
  let raw = source;
  if (raw === undefined) {
    try {
      process.loadEnvFile();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    raw = process.env;
  }

  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(prettifyError(result.error), {
      cause: treeifyError(result.error),
    });
  }

  return toConfig(result.data);
}

export const ConfigToken = new InjectionToken<Config>("ConfigToken");

export const ConfigProvider: FactoryProvider = {
  provide: ConfigToken,
  useFactory: loadConfig,
};
