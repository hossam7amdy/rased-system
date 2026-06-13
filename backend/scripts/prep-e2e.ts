import bcrypt from "bcryptjs";
import { loadConfig } from "../shared/config/config.ts";
import { Database } from "../shared/database/database.ts";
import { ensureDatabase } from "./ensure-database.ts";
import { applySchema } from "./init-db.ts";

// Bootstrap admin — matches the e2e global-setup login (global-setup.ts).
const ADMIN_EMAIL = "admin@rased.edu";
const ADMIN_PASSWORD = "pass@WORD#123";

const config = loadConfig();

// Guard: never let this run against the dev/prod DB.
if (!/e2e/i.test(config.db.name)) {
  throw new Error(
    `Refusing to prep e2e: DB_NAME='${config.db.name}' does not look like an e2e DB. ` +
      `Run via 'yarn workspace backend test:e2e:prep' (loads .env.e2e).`,
  );
}

await ensureDatabase(config);

const db = new Database(config);
try {
  await applySchema(db);

  // Bootstrap admin can't be created via the API (register requires an admin
  // token), so seed it directly. Idempotent on re-runs.
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db.query(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1, $2, 'admin', 'System Administrator')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_EMAIL, hash],
  );

  console.log(`✅ e2e DB '${config.db.name}' ready (schema + bootstrap admin)`);
} finally {
  await db.end();
}
