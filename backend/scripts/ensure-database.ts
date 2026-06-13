import { Pool } from "pg";
import type { Config } from "../shared/config/config.ts";

// Creates the target DB if missing. Connects to the maintenance `postgres` DB —
// you can't CREATE DATABASE while connected to the target. Shared by the
// integration-test setup and the e2e prep script.
export async function ensureDatabase(config: Config): Promise<void> {
  const admin = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: "postgres",
  });
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.db.name],
    );
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE ${config.db.name}`);
    }
  } catch (err) {
    if ((err as { code?: string }).code !== "42P04") throw err; // duplicate_database
  } finally {
    await admin.end();
  }
}
