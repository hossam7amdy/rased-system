import "./env.js";
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  client_encoding: "UTF8",
});

pool.on("connect", () => {
  // Encoding is set via the client_encoding pool option above.
  console.log("📊 Connected to PostgreSQL database (UTF8)");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  process.exit(-1);
});

export default pool;
export const end = () => pool.end();
