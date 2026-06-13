import { createClient } from "redis";
import type { Config } from "../config/config.ts";
import type { CacheClient } from "./cache.client.ts";

export const createRedisClient = (
  config: NonNullable<Config["redis"]>,
): CacheClient => {
  const redis = createClient({
    socket: {
      host: config.host,
      port: config.port,
    },
    password: config.password,
  });

  return Object.assign(redis, {
    [Symbol.asyncDispose]() {
      return redis.close();
    },
  });
};
