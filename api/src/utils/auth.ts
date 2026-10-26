import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env, isProduction } from '../config/env.js';

const BCRYPT_COST = 12;
const REFRESH_SECRET = `${env.JWT_SECRET}:refresh`;

export const ACCESS_COOKIE = 'mf_access';
export const REFRESH_COOKIE = 'mf_refresh';

/**
 * Pre-compute a dummy hash once so unknown-email logins can run a comparison
 * (constant-ish timing) without blocking the event loop.
 */
const dummyHashPromise = bcrypt.hash('mediflow-not-a-real-password', BCRYPT_COST);

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  patientId: string | null;
  providerId: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Compare against a throwaway hash so unknown accounts cost about the same. */
export async function burnPasswordComparison(password: string): Promise<void> {
  const hash = await dummyHashPromise;
  await bcrypt.compare(password, hash);
}

function sign(payload: TokenPayload, secret: string, expiresIn: string | number): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function generateAccessToken(payload: TokenPayload): string {
  return sign(payload, env.JWT_SECRET, env.ACCESS_TOKEN_TTL);
}

export function generateRefreshToken(payload: TokenPayload): string {
  return sign(payload, REFRESH_SECRET, `${env.REFRESH_TOKEN_TTL_DAYS}d`);
}

function decode(token: string, secret: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string' || !decoded.sub && !('userId' in decoded)) return null;
    const value = decoded as jwt.JwtPayload & Partial<TokenPayload>;
    if (!value.userId) return null;
    return {
      userId: value.userId,
      email: value.email ?? '',
      role: (value.role ?? 'PATIENT') as Role,
      patientId: value.patientId ?? null,
      providerId: value.providerId ?? null,
    };
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): TokenPayload | null {
  return decode(token, env.JWT_SECRET);
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  return decode(token, REFRESH_SECRET);
}

export function extractAccessToken(req: {
  headers: { authorization?: string | undefined; cookie?: string | undefined };
}): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ACCESS_COOKIE] ?? null;
}

export function extractRefreshToken(req: { headers: { cookie?: string | undefined } }): string | null {
  return parseCookies(req.headers.cookie)[REFRESH_COOKIE] ?? null;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

const baseCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  patientId: string | null;
  providerId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    patientId: user.patientId,
    providerId: user.providerId,
  };
}
