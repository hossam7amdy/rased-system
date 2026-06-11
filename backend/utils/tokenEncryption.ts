import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	scryptSync,
} from "node:crypto";

const DEFAULT_QR_SECRET = "rased_super_secret_key_2024_qr_signing";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const KEY = scryptSync(
	process.env.QR_SECRET ?? DEFAULT_QR_SECRET,
	"rased_qr_salt",
	32,
);

export interface TokenData {
	sId: string;
	t: number;
}

const TokenEncryption = {
	encrypt(data: TokenData): string {
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

	decrypt(encryptedToken: string): TokenData {
		const parts = encryptedToken.split(":");
		if (parts.length !== 3) {
			throw new Error("Token decoding failed - Invalid Format");
		}

		const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
		const decipher = createDecipheriv(
			ALGORITHM,
			KEY,
			Buffer.from(ivHex, "hex"),
		);
		decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(dataHex, "hex")),
			decipher.final(),
		]);

		return JSON.parse(decrypted.toString("utf8")) as TokenData;
	},

	hash(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	},

	generateSalt(): string {
		return randomBytes(16).toString("hex");
	},
};

export default TokenEncryption;
