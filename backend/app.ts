import "./config/env.ts";
import cors from "cors";
import type { ErrorRequestHandler, Express } from "express";
import express, { json, urlencoded } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { Server } from "socket.io";
import routes from "./routes/index.ts";

// Build the Express app without binding a port; tests call createApp() with no io.
export function createApp(io?: Server): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: "*", credentials: true }));
  app.use(json());
  app.use(urlencoded({ extended: true }));

  if (io) {
    app.use((req, _res, next) => {
      req.io = io;
      next();
    });
  }

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

  return app;
}
