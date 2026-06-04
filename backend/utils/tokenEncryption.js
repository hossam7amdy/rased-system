import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	scryptSync,
} from "node:crypto";

// مفتاح احتياطي في حال غياب QR_SECRET من ملف .env (نفس نمط auth.js)
const DEFAULT_QR_SECRET = "rased_super_secret_key_2024_qr_signing";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV الموصى به لـ GCM

// نشتق مفتاح 32 بايت مرة واحدة عند تحميل الموديول
const KEY = scryptSync(
	process.env.QR_SECRET || DEFAULT_QR_SECRET,
	"rased_qr_salt",
	32,
);

const TokenEncryption = {
	/**
	 * تشفير البيانات بـ AES-256-GCM (تشفير موثّق: أي تلاعب يفشل فك التشفير)
	 * @param {Object} data - بيانات التوكن
	 * @returns {string} - بصيغة iv:authTag:ciphertext (hex)
	 */
	encrypt(data) {
		try {
			const iv = randomBytes(IV_LENGTH);
			const cipher = createCipheriv(ALGORITHM, KEY, iv);

			const json = JSON.stringify(data);
			const encrypted = Buffer.concat([
				cipher.update(json, "utf8"),
				cipher.final(),
			]);
			const authTag = cipher.getAuthTag();

			return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
		} catch (error) {
			console.error("Encryption error:", error);
			throw new Error("Token processing failed");
		}
	},

	/**
	 * فك تشفير التوكن والتحقق من سلامته (auth tag)
	 * @param {string} encryptedToken - بصيغة iv:authTag:ciphertext
	 * @returns {Object} - البيانات الأصلية
	 */
	decrypt(encryptedToken) {
		const parts = encryptedToken?.split(":");
		if (parts?.length !== 3) {
			throw new Error("Token decoding failed - Invalid Format");
		}

		const [ivHex, authTagHex, dataHex] = parts;
		const decipher = createDecipheriv(
			ALGORITHM,
			KEY,
			Buffer.from(ivHex, "hex"),
		);
		decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(dataHex, "hex")),
			decipher.final(), // يرمي خطأ إذا تم التلاعب بالتوكن
		]);

		return JSON.parse(decrypted.toString("utf8"));
	},

	/**
	 * توليد Hash للمفتاح في Redis
	 */
	hash(token) {
		return createHash("sha256").update(token).digest("hex");
	},

	/**
	 * توليد Salt عشوائي
	 */
	generateSalt() {
		return randomBytes(16).toString("hex");
	},
};

export default TokenEncryption;
