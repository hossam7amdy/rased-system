import "../config/env.ts";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";

const email = "admin@rased.edu";
const password = "pass@WORD#123";
const fullName = "System Administrator";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
