import "./config/env.ts";
import { createServer } from "node:http";
import { networkInterfaces as _networkInterfaces } from "node:os";
import cors from "cors";
import express, { json, urlencoded } from "express";
import type { ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import type { JwtPayload } from "./middleware/auth.ts";
import { end } from "./config/database.ts";
import routes from "./routes/index.ts";
import { startRotation, stopRotation } from "./services/qrTokenService.ts";

declare module "socket.io" {
	interface Socket {
		user: JwtPayload;
	}
}

const app = express();
app.set("trust proxy", 1);
const server = createServer(app);

const io = new Server(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
		allowedHeaders: ["Authorization"],
		credentials: true,
	},
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", credentials: true }));
app.use(json());
app.use(urlencoded({ extended: true }));

app.use((req, _res, next) => {
	req.io = io;
	next();
});

app.use((_req, res, next) => {
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	next();
});

const limiter = rateLimit({
	windowMs: 60 * 1000,
	max: 1000,
	message: {
		success: false,
		message: "Too many requests, please try again later.",
	},
});
app.use("/api/", limiter);

app.use("/api", routes);

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

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	console.error("🔥 Server Error:", err);
	res.status(500).json({
		success: false,
		message:
			process.env.NODE_ENV === "production"
				? "Internal Server Error"
				: (err as Error).message,
	});
};
app.use(errorHandler);

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

export default { app, server, io };
