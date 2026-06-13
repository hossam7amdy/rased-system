import { inject } from "injectus";
import type { Server } from "socket.io";
import { CacheClient } from "../../shared/cache/cache-client.ts";
import { ConfigToken } from "../../shared/config/config.ts";
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
  private readonly rotationMs: number;
  private readonly validityMs: number;
  private readonly validitySec: number;
  private activeRotations = new Map<string, NodeJS.Timeout>();

  constructor(
    cache = inject(CacheClient),
    crypto = inject(QrCrypto),
    config = inject(ConfigToken),
  ) {
    this.cache = cache;
    this.crypto = crypto;
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
      console.log(
        `🆕 [QR_STORED] Session: ${sessionId} | Token: ${encryptedToken.substring(0, 12)}...`,
      );
    } catch (err) {
      console.error("⚠️ [CACHE_WRITE_SKIPPED]:", (err as Error).message);
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
      console.error(`🚫 [EXPIRED] Token for session ${sessionId} is too old.`);
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
      console.error("⚠️ [REPLAY_CHECK_SKIPPED]:", (err as Error).message);
    }

    console.log(`✅ [SUCCESS] Token validated for session: ${sessionId}`);
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

  startRotation(sessionId: string | number, io: Server): void {
    this.stopRotation(sessionId);

    const rotate = async (): Promise<void> => {
      try {
        const { token, timestamp } = await this.generateToken(sessionId);
        io.to(sessionId.toString()).emit("qr_update", { token, timestamp });
        console.log(`📡 [SOCKET_EMIT] Token sent to room: ${sessionId}`);
      } catch (err) {
        console.error("🔥 [ROTATION_STEP_ERROR]:", err);
      }
    };

    rotate();
    const interval = setInterval(rotate, this.rotationMs);
    this.activeRotations.set(sessionId.toString(), interval);
  }

  stopRotation(sessionId: string | number): void {
    const sIdStr = sessionId.toString();
    const interval = this.activeRotations.get(sIdStr);
    if (interval) {
      clearInterval(interval);
      this.activeRotations.delete(sIdStr);
      console.log(`⏹️ [ROTATION_STOPPED] Session: ${sIdStr}`);
    }
  }
}
