import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { inject } from "injectus";
import { ConfigToken } from "../../shared/config/config.ts";

const QR_SALT = "rased_qr_salt";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export interface TokenData {
  sId: string;
  t: number;
}

export class QrCrypto {
  private readonly key: Buffer;

  constructor(config = inject(ConfigToken)) {
    this.key = scryptSync(config.qr.secret, QR_SALT, 32);
  }

  encrypt(data: TokenData): string {
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv);

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
  }

  decrypt(encryptedToken: string): TokenData {
    const parts = encryptedToken.split(":");
    if (parts.length !== 3) {
      throw new Error("Token decoding failed - Invalid Format");
    }

    const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as TokenData;
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
