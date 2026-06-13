import type { Pool, PoolClient } from "pg";
import type { Database } from "./database.ts";

export async function withTransaction<T>(
  db: Database | Pool,
  fn: (c: PoolClient) => Promise<T>,
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
