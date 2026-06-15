import { createServer } from "node:http";
import { networkInterfaces as _networkInterfaces } from "node:os";
import { createApp } from "./app.ts";
import { CacheClient } from "./shared/cache/cache-client.ts";
import { ConfigToken } from "./shared/config/config.ts";
import { Database } from "./shared/database/database.ts";
import { LoggerToken } from "./shared/logger/logger.ts";

const app = createApp();
const server = createServer(app);

const config = app.resolve(ConfigToken);
const logger = app.resolve(LoggerToken);

await Promise.all([
  app.resolve(Database).query("SELECT 1"),
  app.resolve(CacheClient).connect(),
]);

const networkInterfaces = _networkInterfaces();
let localIp = "localhost";
for (const name in networkInterfaces) {
  const ifaces = networkInterfaces[name];
  if (!ifaces) continue;
  for (const iface of ifaces) {
    if (iface.family === "IPv4" && !iface.internal) {
      localIp = iface.address;
    }
  }
}

const PORT = config.server.port;

server.listen(PORT, "0.0.0.0", () => {
  logger.info(
    {
      port: PORT,
      local: `http://localhost:${PORT}/api`,
      network: `http://${localIp}:${PORT}/api`,
    },
    "🎓 Rased Attendance System started",
  );
});

process.on("SIGINT", () => {
  logger.info("🛑 shutting down server...");
  server.close(async () => {
    await app.dispose();
    process.exit(0);
  });
});
