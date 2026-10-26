import type { NextFunction, Request, Response } from 'express';
import { extractAccessToken, verifyAccessToken } from '../utils/auth.js';
import { fail } from '../lib/http.js';

/**
 * Verifies the short-lived access token (Authorization header or httpOnly
 * cookie) and attaches the identity — including patientId/providerId — so
 * handlers can authorise without re-querying User.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  if (!token) {
    return fail(res, 401, 'UNAUTHORIZED', 'Please sign in again', req.requestId);
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return fail(res, 401, 'TOKEN_EXPIRED', 'Your session has expired', req.requestId);
  }

  req.user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    patientId: payload.patientId,
    providerId: payload.providerId,
  };
  return next();
}
