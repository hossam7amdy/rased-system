import { type FactoryProvider, InjectionToken } from "injectus";
import { prettifyError, treeifyError } from "zod";
import { type Env, EnvSchema } from "./env.ts";

export interface Config {
  env: Env["NODE_ENV"];
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
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  } | null;
}

function toConfig(env: Env): Config {
  const redis = env.REDIS_HOST
    ? {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
      }
    : null;

  return {
    env: env.NODE_ENV,
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
    qr: { secret: env.QR_SECRET },
    redis,
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
