import net from "node:net";
import { loadConfig } from "../shared/config/config.ts";

// Fail-loud preflight for the pre-push hook: a git hook must not silently start
// daemons, so we only probe and tell the dev how to start Postgres if it's down.
const { db } = loadConfig();

const socket = net.connect({ host: db.host, port: db.port });
socket.setTimeout(2000);

const fail = (): never => {
  console.error(
    `❌ Postgres not reachable at ${db.host}:${db.port}.\n` +
      `   Start it first:  docker compose up -d postgres`,
  );
  process.exit(1);
};

socket.once("connect", () => {
  socket.end();
  process.exit(0);
});
socket.once("timeout", fail);
socket.once("error", fail);
