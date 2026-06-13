import type { RequestHandler } from "express";
import type { Injector } from "injectus";

declare global {
  namespace Express {
    interface Request {
      resolve: Injector["resolve"];
    }
  }
}

export function injectorResolver(injector: Injector): RequestHandler {
  return (req, _res, next) => {
    req.resolve = injector.resolve.bind(injector);
    next();
  };
}
