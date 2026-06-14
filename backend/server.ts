import { createServer } from "node:http";
import { networkInterfaces as _networkInterfaces } from "node:os";
import { Server } from "socket.io";
import { createApp } from "./app.ts";
import { QRTokenService } from "./modules/attendance/qr.service.ts";
import { type JwtPayload, JwtService } from "./modules/auth/jwt.service.ts";
import { CacheClient } from "./shared/cache/cache-client.ts";
import { ConfigToken } from "./shared/config/config.ts";
import { Database } from "./shared/database/database.ts";
import { UnauthorizedError } from "./shared/errors.ts";
import { LoggerToken } from "./shared/logger/logger.ts";

declare module "socket.io" {
  interface Socket {
    user: JwtPayload;
  }
}

// io built first so createApp can wire it in before routes, then attached below.
const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true,
  },
});

const app = createApp(io);
const server = createServer(app);

const config = app.resolve(ConfigToken);
const jwtService = app.resolve(JwtService);
const qrTokenService = app.resolve(QRTokenService);
const logger = app.resolve(LoggerToken);

await Promise.all([
  app.resolve(Database).query("SELECT 1"),
  app.resolve(CacheClient).connect(),
]);

io.attach(server)
  .use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string }).token ??
      (socket.handshake.headers["token"] as string | undefined);

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    try {
      const decoded = jwtService.verify(token);
      socket.user = decoded;
      next();
    } catch (error) {
      logger.warn({ err: error }, "❌ socket JWT auth failed");
      return next(new UnauthorizedError("Invalid authentication token"));
    }
  })
  .on("connection", (socket) => {
    logger.debug(
      { email: socket.user.email, socketId: socket.id },
      "✅ user connected",
    );

    socket.on("start_attendance", async (courseId: unknown) => {
      try {
        if (!courseId) {
          logger.warn("❌ start_attendance: courseId is undefined or null");
          socket.emit("error", { message: "معرف المادة غير صالح." });
          return;
        }

        const roomId = String(courseId);

        logger.debug(
          { email: socket.user.email, roomId },
          "🎯 [ROOM_JOIN] professor joining room",
        );

        socket.join(roomId);
        qrTokenService.startRotation(roomId, io);

        socket.emit("session_started", {
          courseId: roomId,
          message: "QR rotation active.",
        });
      } catch (error) {
        logger.error({ err: error }, "🔥 socket error (start_attendance)");
        socket.emit("error", { message: "Failed to start QR session." });
      }
    });

    socket.on("stop_attendance", (courseId: unknown) => {
      try {
        if (!courseId) return;
        const roomId = String(courseId);
        qrTokenService.stopRotation(roomId);
        socket.leave(roomId);
        logger.debug({ roomId }, "⏹️ session stopped for room");
      } catch (error) {
        logger.error({ err: error }, "stop session error");
      }
    });

    socket.on("disconnect", () => {
      logger.debug(
        { email: socket.user.email, socketId: socket.id },
        "❌ user disconnected",
      );
    });
  });

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
