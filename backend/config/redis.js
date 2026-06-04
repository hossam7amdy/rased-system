import { createClient } from "redis";

// Loaded at module-eval time: server.js's process.loadEnvFile() runs after
// imports, so this module must load env itself before reading REDIS_HOST.
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on real environment variables (e.g. production).
}

class InMemoryCache {
  constructor() {
    this._store = new Map();
    this._timers = new Map();
    console.log("🟡 REDIS_HOST not set — using in-memory cache");
  }

  get isOpen() {
    return true;
  }

  on() {}

  async connect() {}

  async get(key) {
    const entry = this._store.get(key);
    return entry !== undefined ? entry : null;
  }

  async set(key, value, options) {
    this._store.set(key, value);
    if (options?.EX) {
      this._scheduleExpiry(key, options.EX * 1000);
    }
  }

  async setEx(key, ttl, value) {
    this._store.set(key, value);
    this._scheduleExpiry(key, ttl * 1000);
  }

  _scheduleExpiry(key, ms) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
    }
    const timer = setTimeout(() => {
      this._store.delete(key);
      this._timers.delete(key);
    }, ms);
    this._timers.set(key, timer);
  }
}

let cacheClient;

if (!process.env.REDIS_HOST) {
  cacheClient = new InMemoryCache();
} else {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) return new Error("Redis connection failed");
        return Math.min(retries * 50, 500);
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

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
        "⚠️ Could not connect to Redis. Make sure redis-server is running.",
      );
    }
  })();

  cacheClient = redisClient;
}

export default cacheClient;
