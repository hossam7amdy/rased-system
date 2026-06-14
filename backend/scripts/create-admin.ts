import bcrypt from "bcryptjs";
import { loadConfig } from "../shared/config/config.ts";
import { Database } from "../shared/database/database.ts";
import { createLogger } from "../shared/logger/logger.ts";

const email = "admin@rased.edu";
const password = "pass@WORD#123";
const fullName = "System Administrator";

const config = loadConfig();
const logger = createLogger(config);
const db = new Database(config);

try {
  const hashedPassword = await bcrypt.hash(password, 10);

  const res = await db.query(
    `
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO NOTHING
    RETURNING id;
    `,
    [email, hashedPassword, "admin", fullName],
  );

  if (res.rows.length > 0) {
    // Credentials are hardcoded above for the operator; never log the password.
    logger.info({ email }, "✅ admin account created");
  } else {
    logger.warn("⚠️ user already exists or check column names");
  }
} finally {
  await db.end();
}
