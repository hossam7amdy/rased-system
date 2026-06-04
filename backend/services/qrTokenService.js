import cacheClient from "../config/redis.js";
import TokenEncryption from "../utils/tokenEncryption.js";

// تدوير الكود كل 8 ثوانٍ على الشاشة
export const ROTATION_INTERVAL_MS = 8000;
// نافذة صلاحية التوكن: أطول من فترة التدوير + تأخير الـ polling لمنع الـ race
// (الشاشة تتأخر حتى 3 ثوانٍ في جلب الكود، لذا 20 ثانية تغطي تدويرة كاملة)
export const TOKEN_VALIDITY_MS = 20000;
const TOKEN_VALIDITY_SEC = Math.ceil(TOKEN_VALIDITY_MS / 1000);

class QRTokenService {
	constructor() {
		// Map لتخزين الفواصل الزمنية (Intervals) لكل مادة
		this.activeRotations = new Map();
	}

	/**
	 * توليد توكن جديد وتخزينه في الكاش (Redis أو in-memory)
	 */
	async generateToken(sessionId) {
		const timestamp = Date.now();
		// نستخدم sessionId كاسم موحد سواء كان معرف مادة أو معرف جلسة
		const tokenData = { sId: sessionId.toString(), t: timestamp };
		const encryptedToken = TokenEncryption.encrypt(tokenData);

		// نخزّن أحدث توكن صالح ليقرأه الدكتور عبر getCurrentQR (polling)
		const cacheKey = `active_qr_session_${sessionId}`;
		try {
			await cacheClient.set(cacheKey, encryptedToken, {
				EX: TOKEN_VALIDITY_SEC,
			});
			console.log(
				`🆕 [QR_STORED] Session: ${sessionId} | Token: ${encryptedToken.substring(0, 12)}...`,
			);
		} catch (err) {
			// فشل الكاش لا يمنع التوليد — الصلاحية تُتحقق من التوقيت داخل التوكن
			console.error("⚠️ [CACHE_WRITE_SKIPPED]:", err.message);
		}

		return { token: encryptedToken, timestamp };
	}

	/**
	 * التحقق من التوكن القادم من الطالب.
	 * يعتمد على نافذة زمنية (freshness window) بدلاً من المطابقة الحرفية مع
	 * أحدث توكن في الكاش — هذا يلغي الـ race بين تدوير الكود و polling الشاشة.
	 * سلامة التوكن مضمونة بتشفير AES-GCM (أي تلاعب يُفشل فك التشفير).
	 */
	async validateToken(token) {
		// 1. فك التشفير والتحقق من السلامة (يرمي خطأ إذا تم التلاعب أو فسد الكود)
		let decoded;
		try {
			decoded = TokenEncryption.decrypt(token);
		} catch (_err) {
			return { valid: false, message: "رمز غير صالح أو تالف." };
		}

		const sessionId = decoded.sId;
		const issuedAt = decoded.t;

		if (!sessionId || !issuedAt) {
			return { valid: false, message: "بيانات الرمز غير مكتملة." };
		}

		// 2. التحقق من نافذة الصلاحية الزمنية
		const age = Date.now() - issuedAt;
		if (age < 0 || age > TOKEN_VALIDITY_MS) {
			console.error(`🚫 [EXPIRED] Token for session ${sessionId} is too old.`);
			return {
				valid: false,
				message: "انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.",
			};
		}

		// 3. حماية من الـ Replay (منع مسح نفس الكود مرتين) — best-effort
		const replayKey = `used_qr:${TokenEncryption.hash(token)}`;
		try {
			const alreadyUsed = await cacheClient.get(replayKey);
			if (alreadyUsed) {
				return { valid: false, message: "تم استخدام هذا الرمز مسبقاً." };
			}
			await cacheClient.setEx(replayKey, TOKEN_VALIDITY_SEC, "true");
		} catch (err) {
			// فشل الكاش لا يمنع التحضير — الـ DB يمنع التكرار في نفس الجلسة
			console.error("⚠️ [REPLAY_CHECK_SKIPPED]:", err.message);
		}

		console.log(`✅ [SUCCESS] Token validated for session: ${sessionId}`);
		return { valid: true, courseId: sessionId };
	}

	/**
	 * بدء تدوير الأكواد وإرسالها عبر السوكيت
	 */
	startRotation(sessionId, io) {
		// إيقاف أي تدوير قديم لنفس الجلسة منعاً للتداخل
		this.stopRotation(sessionId);

		const rotate = async () => {
			try {
				const { token, timestamp } = await this.generateToken(sessionId);

				// إرسال التوكن لغرفة السوكيت الخاصة بالجلسة
				// تأكد أن الدكتور عمل socket.join(sessionId)
				io.to(sessionId.toString()).emit("qr_update", { token, timestamp });

				console.log(`📡 [SOCKET_EMIT] Token sent to room: ${sessionId}`);
			} catch (err) {
				console.error("🔥 [ROTATION_STEP_ERROR]:", err);
			}
		};

		// تنفيذ أول مرة فوراً
		rotate();

		// إعداد التكرار
		const interval = setInterval(rotate, ROTATION_INTERVAL_MS);
		this.activeRotations.set(sessionId.toString(), interval);
	}

	/**
	 * إيقاف تدوير الأكواد
	 */
	stopRotation(sessionId) {
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
