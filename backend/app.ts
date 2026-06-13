import "./config/env.ts";
import cors from "cors";
import type { Express } from "express";
import express, { json, urlencoded } from "express";
import helmet from "helmet";
import type { Injector, Provider } from "injectus";
import type { Server } from "socket.io";
import { createAppInjector } from "./app.injector.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { injectorResolver } from "./middleware/injector-resolver.ts";
import { ioServer } from "./middleware/io-server.ts";
import { rateLimiter } from "./middleware/rate-limiter.ts";
import { zodValidator } from "./middleware/zod-validator.ts";
import routes from "./routes/index.ts";

interface Application extends Express {
  resolve: Injector["resolve"];
  dispose: Injector["dispose"];
}

// Build the Express app without binding a port; tests call createApp() with no io.
export function createApp(
  io?: Server,
  providerOverrides?: Provider[],
): Application {
  const app = express();
  const injector = createAppInjector(providerOverrides);

  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  // TODO: should specify a list of allowed origins

  app.use(cors({ origin: "*", credentials: true }));

  app.use(json());

  app.use(urlencoded({ extended: true }));

  if (io) app.use(ioServer(io));

  app.use(zodValidator);

  app.use(injectorResolver(injector));

  app.use("/api/", rateLimiter());

  app.use("/api", routes);

  app.use(errorHandler);

  return Object.assign(app, {
    resolve: injector.resolve.bind(injector),
    dispose: injector.dispose.bind(injector),
  });
}
