import { type FactoryProvider, InjectionToken, inject } from "injectus";
import pino from "pino";
import { type Config, ConfigToken } from "../config/config.ts";

export type Logger = pino.Logger;

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

// Defense-in-depth: never emit these keys, even if a caller passes them in a
// merge object. Top-level and one level deep cover the shapes we log.
const REDACT_PATHS = [
  "password",
  "token",
  "authorization",
  "*.password",
  "*.token",
  "*.authorization",
];

function defaultLogLevel(config: Config): LogLevel {
  if (config.env === "production") return "info";
  if (config.env === "test") return "silent";
  return "debug";
}

export function createLogger(config: Config): Logger {
  const isDev = config.env === "development";

  return pino({
    level: config.logLevel ?? defaultLogLevel(config),
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    // Dev: human-readable colorized output. Prod: raw JSON to stdout (12-factor,
    // aggregator-ready). Test runs silent, so the transport is never built.
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}

export const LoggerToken = new InjectionToken<Logger>("Logger");

export const LoggerProvider: FactoryProvider = {
  provide: LoggerToken,
  useFactory: () => createLogger(inject(ConfigToken)),
};
