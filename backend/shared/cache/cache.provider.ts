import { type FactoryProvider, inject } from "injectus";
import { ConfigToken } from "../config/config.ts";
import { CacheClient } from "./cache-client.ts";
import { InMemoryCache } from "./in-memory.ts";
import { createRedisClient } from "./redis.ts";

export const CacheProvider: FactoryProvider = {
  provide: CacheClient,
  useFactory: () => {
    const { redis } = inject(ConfigToken);
    if (redis) {
      return createRedisClient(redis);
    }
    return new InMemoryCache();
  },
};
