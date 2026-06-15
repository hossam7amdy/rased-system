import { inject } from "injectus";
import { CacheClient } from "../../shared/cache/cache-client.ts";
import { ConfigToken } from "../../shared/config/config.ts";
import { type Logger, LoggerToken } from "../../shared/logger/logger.ts";
import { QrCrypto } from "./qr.crypto.ts";

interface GeneratedToken {
  token: string;
  timestamp: number;
}

interface ValidationResult {
  valid: boolean;
  message?: string;
  courseId?: string;
}

export class QRTokenService {
  private readonly cache: CacheClient;
  private readonly crypto: QrCrypto;
  private readonly logger: Logger;
  private readonly rotationMs: number;
  private readonly validityMs: number;
  private readonly validitySec: number;
  private activeRotations = new Map<string, NodeJS.Timeout>();

  constructor(
    cache = inject(CacheClient),
    crypto = inject(QrCrypto),
    config = inject(ConfigToken),
    logger = inject(LoggerToken),
  ) {
    this.cache = cache;
    this.crypto = crypto;
    this.logger = logger;
    this.rotationMs = config.qr.rotationMs;
    this.validityMs = config.qr.validityMs;
    this.validitySec = Math.ceil(this.validityMs / 1000);
  }

  async generateToken(sessionId: string | number): Promise<GeneratedToken> {
    const timestamp = Date.now();
    const tokenData = { sId: sessionId.toString(), t: timestamp };
    const encryptedToken = this.crypto.encrypt(tokenData);

    const cacheKey = `active_qr_session_${sessionId}`;
    try {
      await this.cache.set(cacheKey, encryptedToken, {
        expiration: {
          value: this.validitySec,
          type: "EX",
        },
      });
      this.logger.debug(
        { sessionId, tokenPreview: encryptedToken.substring(0, 12) },
        "🆕 [QR_STORED] token stored",
      );
    } catch (err) {
      this.logger.error({ err }, "⚠️ [CACHE_WRITE_SKIPPED]");
    }

    return { token: encryptedToken, timestamp };
  }

  async validateToken(token: string): Promise<ValidationResult> {
    let decoded: ReturnType<QrCrypto["decrypt"]>;
    try {
      decoded = this.crypto.decrypt(token);
    } catch (_err) {
      return { valid: false, message: "رمز غير صالح أو تالف." };
    }

    const { sId: sessionId, t: issuedAt } = decoded;

    if (!sessionId || !issuedAt) {
      return { valid: false, message: "بيانات الرمز غير مكتملة." };
    }

    const age = Date.now() - issuedAt;
    if (age < 0 || age > this.validityMs) {
      this.logger.warn({ sessionId }, "🚫 [EXPIRED] token too old");
      return {
        valid: false,
        message: "انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.",
      };
    }

    const replayKey = `used_qr:${this.crypto.hash(token)}`;
    try {
      const alreadyUsed = await this.cache.get(replayKey);
      if (alreadyUsed) {
        return { valid: false, message: "تم استخدام هذا الرمز مسبقاً." };
      }
      await this.cache.setEx(replayKey, this.validitySec, "true");
    } catch (err) {
      this.logger.error({ err }, "⚠️ [REPLAY_CHECK_SKIPPED]");
    }

    this.logger.debug({ sessionId }, "✅ [SUCCESS] token validated");
    return { valid: true, courseId: sessionId };
  }

  // Seconds left until the current token rotates, clamped at 0.
  remainingSeconds(token: string): number {
    const { t: generatedAt } = this.crypto.decrypt(token);
    return Math.max(
      0,
      Math.round((this.rotationMs - (Date.now() - generatedAt)) / 1000),
    );
  }

  startRotation(sessionId: string | number): void {
    this.stopRotation(sessionId);

    const rotate = async (): Promise<void> => {
      try {
        // Regenerate and cache the current token; clients poll /current-qr.
        await this.generateToken(sessionId);
      } catch (err) {
        this.logger.error({ err }, "🔥 [ROTATION_STEP_ERROR]");
      }
    };

    rotate();
    // unref so an active rotation never keeps the process alive (clean SIGINT /
    // test exit); the HTTP server is what holds the loop open in production.
    const interval = setInterval(rotate, this.rotationMs).unref();
    this.activeRotations.set(sessionId.toString(), interval);
  }

  stopRotation(sessionId: string | number): void {
    const sIdStr = sessionId.toString();
    const interval = this.activeRotations.get(sIdStr);
    if (interval) {
      clearInterval(interval);
      this.activeRotations.delete(sIdStr);
      this.logger.debug({ sessionId: sIdStr }, "⏹️ [ROTATION_STOPPED]");
    }
  }
}
