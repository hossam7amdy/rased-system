import "./config/env.ts";
import { createServer } from "node:http";
import { networkInterfaces as _networkInterfaces } from "node:os";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createApp } from "./app.ts";
import { end } from "./config/database.ts";
import type { JwtPayload } from "./middleware/auth.ts";
import { startRotation, stopRotation } from "./services/qrTokenService.ts";

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
io.attach(server);

io.use((socket, next) => {
  const token =
    (socket.handshake.auth as { token?: string }).token ??
    (socket.handshake.headers["token"] as string | undefined);

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET ?? "rased_super_secret_key_2024_access",
    ) as JwtPayload;
    socket.user = decoded;
    next();
  } catch (error) {
    console.log("❌ JWT Auth Error Detail:", (error as Error).message);
    return next(new Error("Invalid authentication token"));
  }
});

io.on("connection", (socket) => {
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
      startRotation(roomId, io);

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
      stopRotation(roomId);
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

const PORT = Number(process.env.PORT) || 5000;

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
  server.close(() => {
    end();
    process.exit(0);
  });
});
