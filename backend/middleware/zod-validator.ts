import type { NextFunction, Request, Response } from "express";
import { type output, prettifyError, type ZodType } from "zod";
import { BadRequestError } from "../shared/errors.ts";

declare global {
  namespace Express {
    interface Request {
      validBody<S extends ZodType>(schema: S): output<S>;
      validQuery<S extends ZodType>(schema: S): output<S>;
    }
  }
}

export function zodValidator(req: Request, _res: Response, next: NextFunction) {
  req.validBody = (s) => {
    const result = s.safeParse(req.body);
    if (!result.success) {
      throw new BadRequestError(prettifyError(result.error));
    }
    return result.data;
  };
  req.validQuery = (s) => {
    const result = s.safeParse(req.query);
    if (!result.success) {
      throw new BadRequestError(prettifyError(result.error));
    }
    return result.data;
  };
  next();
}
