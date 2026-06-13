import { createClient } from "redis";
import type { Config } from "../config/config.ts";
import type { CacheClient } from "./cache-client.ts";

export const createRedisClient = (
  config: NonNullable<Config["redis"]>,
): CacheClient => {
  const redis = createClient({
    socket: {
      host: config.host,
      port: config.port,
    },
    password: config.password,
    database: config.db,
  });

  // Capture the prototype connect before Object.assign shadows it, otherwise
  // the wrapper below would call itself and recurse infinitely.
  const redisConnect = redis.connect.bind(redis);

  return Object.assign(redis, {
    async connect(): Promise<void> {
      await redisConnect();
    },
    async clear(): Promise<void> {
      await redis.flushDb();
    },
    [Symbol.asyncDispose]() {
      return redis.close();
    },
  });
};
