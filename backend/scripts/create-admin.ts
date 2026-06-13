import bcrypt from "bcryptjs";
import { loadConfig } from "../shared/config/config.ts";
import { Database } from "../shared/database/database.ts";

const email = "admin@rased.edu";
const password = "pass@WORD#123";
const fullName = "System Administrator";

const config = loadConfig();
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
    console.log("✅ Admin account created successfully!");
    console.log(`Email: ${email} | Password: ${password}`);
  } else {
    console.log("⚠️ User already exists or check column names.");
  }
} finally {
  await db.end();
}
