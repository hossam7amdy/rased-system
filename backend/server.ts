import { createServer } from "node:http";
import { networkInterfaces as _networkInterfaces } from "node:os";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createApp } from "./app.ts";
import type { JwtPayload } from "./middleware/auth.ts";
import { QRTokenService } from "./services/qrTokenService.ts";
import { CacheClient } from "./shared/cache/cache-client.ts";
import { ConfigToken } from "./shared/config/config.ts";
import { Database } from "./shared/database/database.ts";

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
const qrTokenService = app.resolve(QRTokenService);

await Promise.all([
  app.resolve(Database).connect(),
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
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch (error) {
      console.log("❌ JWT Auth Error Detail:", (error as Error).message);
      return next(new Error("Invalid authentication token"));
    }
  })
  .on("connection", (socket) => {
    console.log(
      `✅ User connected: ${socket.user.email} | Socket ID: ${socket.id}`,
    );

    socket.on("start_attendance", async (courseId: unknown) => {
      try {
        if (!courseId) {
          console.error("❌ Error: courseId is undefined or null");
          socket.emit("error", { message: "معرف المادة غير صالح." });
          return;
        }

        const roomId = String(courseId);

        console.log(
          `🎯 [ROOM_JOIN] Professor ${socket.user.email} joining EXACT room: "${roomId}"`,
        );

        socket.join(roomId);
        qrTokenService.startRotation(roomId, io);

        socket.emit("session_started", {
          courseId: roomId,
          message: "QR rotation active.",
        });
      } catch (error) {
        console.error("🔥 Socket Error (start_attendance):", error);
        socket.emit("error", { message: "Failed to start QR session." });
      }
    });

    socket.on("stop_attendance", (courseId: unknown) => {
      try {
        if (!courseId) return;
        const roomId = String(courseId);
        qrTokenService.stopRotation(roomId);
        socket.leave(roomId);
        console.log(`⏹️ Session stopped for room: "${roomId}"`);
      } catch (error) {
        console.error("Stop session error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(
        `❌ User disconnected: ${socket.user.email} | Socket ID: ${socket.id}`,
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
  console.log(`
╔══════════════════════════════════════════════════════════╗
║        🎓 Rased Attendance System - Secure Mode          ║
╠══════════════════════════════════════════════════════════╣
║ 🚀 Port: ${PORT}                                         ║
║ 🔗 Local: http://localhost:${PORT}/api                   ║
║ 📱 Network: http://${localIp}:${PORT}/api                ║
║ 🛡️  Redis: Active & Monitoring                           ║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on("SIGINT", () => {
  console.log("🛑 Shutting down server...");
  server.close(async () => {
    await app.dispose();
    process.exit(0);
  });
});
