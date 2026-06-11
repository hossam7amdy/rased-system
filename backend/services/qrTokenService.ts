import type { Server } from "socket.io";
import cacheClient from "../config/redis.ts";
import TokenEncryption from "../utils/tokenEncryption.ts";

export const ROTATION_INTERVAL_MS = 8000;
export const TOKEN_VALIDITY_MS = 20000;
const TOKEN_VALIDITY_SEC = Math.ceil(TOKEN_VALIDITY_MS / 1000);

interface GeneratedToken {
  token: string;
  timestamp: number;
}

interface ValidationResult {
  valid: boolean;
  message?: string;
  courseId?: string;
}

class QRTokenService {
  private activeRotations = new Map<string, NodeJS.Timeout>();

  async generateToken(sessionId: string | number): Promise<GeneratedToken> {
    const timestamp = Date.now();
    const tokenData = { sId: sessionId.toString(), t: timestamp };
    const encryptedToken = TokenEncryption.encrypt(tokenData);

    const cacheKey = `active_qr_session_${sessionId}`;
    try {
      await cacheClient.set(cacheKey, encryptedToken, {
        EX: TOKEN_VALIDITY_SEC,
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
    let decoded: ReturnType<typeof TokenEncryption.decrypt>;
    try {
      decoded = TokenEncryption.decrypt(token);
    } catch (_err) {
      return { valid: false, message: "رمز غير صالح أو تالف." };
    }

    const { sId: sessionId, t: issuedAt } = decoded;

    if (!sessionId || !issuedAt) {
      return { valid: false, message: "بيانات الرمز غير مكتملة." };
    }

    const age = Date.now() - issuedAt;
    if (age < 0 || age > TOKEN_VALIDITY_MS) {
      console.error(`🚫 [EXPIRED] Token for session ${sessionId} is too old.`);
      return {
        valid: false,
        message: "انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.",
      };
    }

    const replayKey = `used_qr:${TokenEncryption.hash(token)}`;
    try {
      const alreadyUsed = await cacheClient.get(replayKey);
      if (alreadyUsed) {
        return { valid: false, message: "تم استخدام هذا الرمز مسبقاً." };
      }
      await cacheClient.setEx(replayKey, TOKEN_VALIDITY_SEC, "true");
    } catch (err) {
      console.error("⚠️ [REPLAY_CHECK_SKIPPED]:", (err as Error).message);
    }

    console.log(`✅ [SUCCESS] Token validated for session: ${sessionId}`);
    return { valid: true, courseId: sessionId };
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
    const interval = setInterval(rotate, ROTATION_INTERVAL_MS);
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

const qrTokenService = new QRTokenService();

export default qrTokenService;
export const startRotation = qrTokenService.startRotation.bind(qrTokenService);
export const stopRotation = qrTokenService.stopRotation.bind(qrTokenService);
