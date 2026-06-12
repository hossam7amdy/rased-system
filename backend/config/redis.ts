import "./env.ts";
import { createClient } from "redis";

interface SetOptions {
  EX?: number;
}

interface CacheClient {
  readonly isOpen: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: SetOptions): Promise<unknown>;
  setEx(key: string, ttl: number, value: string): Promise<unknown>;
}

class InMemoryCache implements CacheClient {
  private readonly _store = new Map<string, string>();
  private readonly _timers = new Map<string, NodeJS.Timeout>();

  constructor(reason: string) {
    console.log(`🟡 ${reason} — using in-memory cache`);
  }

  get isOpen(): boolean {
    return true;
  }

  async get(key: string): Promise<string | null> {
    const entry = this._store.get(key);
    return entry !== undefined ? entry : null;
  }

  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    this._store.set(key, value);
    if (options?.EX) {
      this._scheduleExpiry(key, options.EX * 1000);
    }
  }

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    this._store.set(key, value);
    this._scheduleExpiry(key, ttl * 1000);
  }

  private _scheduleExpiry(key: string, ms: number): void {
    const existing = this._timers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this._store.delete(key);
      this._timers.delete(key);
      // Don't let pending expiry timers keep the process alive (e.g. test runner).
    }, ms).unref();
    this._timers.set(key, timer);
  }
}

/**
 * Wrapper with a stable reference that delegates to the current implementation
 * (Redis or in-memory). Needed because ESM default exports capture the value at
 * export time, not a live binding — so we need a stable object whose internals
 * can be swapped on Redis connection failure.
 */
class CacheProxy implements CacheClient {
  private _impl: CacheClient;

  constructor(impl: CacheClient) {
    this._impl = impl;
  }

  _swap(impl: CacheClient): void {
    this._impl = impl;
  }

  get isOpen(): boolean {
    return this._impl.isOpen;
  }

  get(key: string): Promise<string | null> {
    return this._impl.get(key);
  }

  set(key: string, value: string, options?: SetOptions): Promise<unknown> {
    return this._impl.set(key, value, options);
  }

  setEx(key: string, ttl: number, value: string): Promise<unknown> {
    return this._impl.setEx(key, ttl, value);
  }
}

let cacheProxy: CacheProxy;

if (!process.env.REDIS_HOST) {
  cacheProxy = new CacheProxy(new InMemoryCache("REDIS_HOST not set"));
} else {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) return new Error("Redis connection failed");
        return Math.min(retries * 50, 500);
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  cacheProxy = new CacheProxy(redisClient as unknown as CacheClient);

  redisClient.on("connect", () => {
    console.log("🔴 Connected to Redis");
  });

  redisClient.on("error", (_err) => {
    console.error("❌ Redis Connection Error");
  });

  (async () => {
    try {
      await redisClient.connect();
    } catch (_err) {
      console.error(
        "⚠️ Could not connect to Redis — falling back to in-memory cache.",
      );
      cacheProxy._swap(new InMemoryCache("Redis unavailable"));
    }
  })();
}

export default cacheProxy;
