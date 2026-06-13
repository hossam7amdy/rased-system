import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";
import { loadConfig } from "../shared/config/config.ts";

const email = "admin@rased.edu";
const password = "pass@WORD#123";
const fullName = "System Administrator";

const { db } = loadConfig();

const pool = new Pool({
  host: db.host,
  port: db.port,
  database: db.name,
  user: db.user,
  password: db.password,
});

let client: PoolClient | null = null;

try {
  client = await pool.connect();

  const hashedPassword = await bcrypt.hash(password, 10);

  const res = await client.query(
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
  client?.release();
  await pool.end();
}
