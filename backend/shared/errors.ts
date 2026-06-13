export type StatusCode = 400 | 401 | 403 | 404 | 409;

export abstract class HttpError extends Error {
  readonly statusCode: StatusCode;

  constructor(statusCode: StatusCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}
