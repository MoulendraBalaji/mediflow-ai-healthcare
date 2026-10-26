import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Invalid request', details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in again') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const unprocessable = (message = 'Some fields need attention', details?: unknown) =>
  new HttpError(422, 'VALIDATION_ERROR', message, details);
export const upstream = (message = 'The AI service is unavailable right now', details?: unknown) =>
  new HttpError(503, 'AI_UNAVAILABLE', message, details);

/** Express 4 does not handle rejected promises. */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    throw unprocessable('Please check the highlighted fields', formatZodIssues(result.error));
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) {
    throw unprocessable('Invalid query parameters', formatZodIssues(result.error));
  }
  return result.data;
}

export function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'form',
    message: issue.message,
  }));
}

/** Success envelope: { data, meta? } */
export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
  return res.json(meta ? { data, meta } : { data });
}

/** Failure envelope (used by the central error handler and 404s). */
export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown
): Response {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      ...(requestId ? { requestId } : {}),
    },
  });
}

/** Cache read-only list responses briefly; private so proxies never share them. */
export function privateCache(res: Response, seconds = 30): void {
  res.setHeader('Cache-Control', `private, max-age=${seconds}`);
  res.setHeader('Vary', 'Authorization, Cookie');
}

export function setNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

export type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
