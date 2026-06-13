import type { RequestHandler } from "express";
import type { Server } from "socket.io";

declare global {
  namespace Express {
    interface Request {
      io?: import("socket.io").Server;
    }
  }
}

export function ioServer(io: Server): RequestHandler {
  return (req, _res, next) => {
    req.io = io;
    next();
  };
}
