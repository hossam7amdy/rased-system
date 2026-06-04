import "./env.js";
import { createClient } from "redis";

class InMemoryCache {
	constructor(reason) {
		this._store = new Map();
		this._timers = new Map();
		console.log(`🟡 ${reason} — using in-memory cache`);
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

/**
 * Wrapper بمرجع ثابت يفوّض إلى التطبيق الحالي (Redis أو in-memory).
 * default export في ESM يلتقط القيمة لحظة التصدير وليس مرجعاً حياً، لذا نحتاج
 * كائناً ثابتاً نستطيع تبديل ما بداخله عند فشل الاتصال بـ Redis.
 */
class CacheProxy {
	constructor(impl) {
		this._impl = impl;
	}

	_swap(impl) {
		this._impl = impl;
	}

	get isOpen() {
		return this._impl.isOpen;
	}

	get(...args) {
		return this._impl.get(...args);
	}

	set(...args) {
		return this._impl.set(...args);
	}

	setEx(...args) {
		return this._impl.setEx(...args);
	}
}

let cacheProxy;

if (!process.env.REDIS_HOST) {
	cacheProxy = new CacheProxy(new InMemoryCache("REDIS_HOST not set"));
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

	cacheProxy = new CacheProxy(redisClient);

	redisClient.on("connect", () => {
		console.log("🔴 Connected to Redis");
	});

	// نتجاهل أخطاء الاتصال هنا (يعالجها reconnectStrategy)، لكن نسجّلها
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
