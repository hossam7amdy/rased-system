import type { Logger } from "../logger/logger.ts";
import { CacheClient, type SetOptions } from "./cache-client.ts";

export class InMemoryCache extends CacheClient {
  readonly #store = new Map<string, string>();
  readonly #timers = new Map<string, NodeJS.Timeout>();

  constructor(logger: Logger) {
    super();
    logger.info("🟡 Using in-memory cache");
  }

  get isOpen(): boolean {
    return true;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.#store.get(key);
    return entry !== undefined ? entry : null;
  }

  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    this.#store.set(key, value);
    if (options?.expiration) {
      this.scheduleExpiry(key, options.expiration.value * 1000);
    }
  }

  async setEx(key: string, ttl: number, value: string): Promise<void> {
    this.#store.set(key, value);
    this.scheduleExpiry(key, ttl * 1000);
  }

  async close(): Promise<void> {
    this.#store.clear();
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  clear(): Promise<void> {
    return this.close();
  }

  private scheduleExpiry(key: string, ms: number): void {
    const existing = this.#timers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.#store.delete(key);
      this.#timers.delete(key);
      // Don't let pending expiry timers keep the process alive (e.g. test runner).
    }, ms).unref();
    this.#timers.set(key, timer);
  }
}
