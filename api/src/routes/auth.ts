import { Router } from 'express';
import { z } from 'zod';
import { Gender, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, HttpError, ok, parseBody, setNoStore } from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  burnPasswordComparison,
  clearAuthCookies,
  extractRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  publicUser,
  setAuthCookies,
  verifyPassword,
  verifyRefreshToken,
  type TokenPayload,
} from '../utils/auth.js';
import { audit } from '../lib/audit.js';

const router = Router();

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'That password is too long');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, 'Tell us your name').max(120).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  dateOfBirth: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date of birth')
    .refine((value) => new Date(value) < new Date(), 'Date of birth must be in the past'),
  gender: z.nativeEnum(Gender).default(Gender.OTHER),
  contactNumber: z.string().trim().max(40).optional(),
  role: z.string().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
});

function tokenPayload(user: {
  id: string;
  email: string;
  role: Role;
  patientId: string | null;
  providerId: string | null;
}): TokenPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    patientId: user.patientId,
    providerId: user.providerId,
  };
}

function issueCookies(
  res: Parameters<typeof setAuthCookies>[0],
  user: {
    id: string;
    email: string;
    role: Role;
    patientId: string | null;
    providerId: string | null;
  }
): void {
  const payload = tokenPayload(user);
  setAuthCookies(res, generateAccessToken(payload), generateRefreshToken(payload));
}

const userInclude = {
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      email: true,
      contactNumber: true,
      address: true,
    },
  },
  provider: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialty: true,
      email: true,
      contactNumber: true,
      facility: { select: { id: true, name: true, facilityType: true, address: true } },
    },
  },
} as const;

/** POST /api/auth/register — patients only. Staff accounts are provisioned by an admin. */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req);
    setNoStore(res);

    if (body.role && body.role.toUpperCase() !== 'PATIENT') {
      throw new HttpError(
        403,
        'SELF_REGISTRATION_FORBIDDEN',
        'Clinician and admin accounts are created by an administrator, not by self-registration.'
      );
    }

    const firstName = body.firstName ?? body.name?.split(' ')[0] ?? '';
    const lastName = body.lastName ?? body.name?.split(' ').slice(1).join(' ') ?? '';
    if (!firstName) throw new HttpError(422, 'VALIDATION_ERROR', 'Tell us your name');

    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) {
      throw new HttpError(409, 'ALREADY_EXISTS', 'An account with that email already exists');
    }

    const password = await hashPassword(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          firstName,
          lastName,
          dateOfBirth: new Date(body.dateOfBirth),
          gender: body.gender,
          email: body.email,
          contactNumber: body.contactNumber ?? null,
        },
        select: { id: true },
      });

      return tx.user.create({
        data: {
          email: body.email,
          password,
          name: [firstName, lastName].filter(Boolean).join(' '),
          role: 'PATIENT',
          patientId: patient.id,
        },
        include: userInclude,
      });
    });

    issueCookies(res, user);
    audit(req, 'AUTH_REGISTER', 'USER', user.patientId, { role: user.role });

    return res.status(201).json({
      data: { user: { ...publicUser(user), patient: user.patient, provider: null } },
    });
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req);
    setNoStore(res);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: userInclude,
    });

    if (!user) {
      await burnPasswordComparison(body.password);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const valid = await verifyPassword(body.password, user.password);
    if (!valid) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    if (user.disabledAt) {
      throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Contact support.');
    }

    issueCookies(res, user);
    audit(req, 'AUTH_LOGIN', 'USER', user.patientId);

    return ok(res, {
      user: { ...publicUser(user), patient: user.patient, provider: user.provider },
    });
  })
);

/** POST /api/auth/refresh — rotates both cookies using the refresh cookie. */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    setNoStore(res);
    const token = extractRefreshToken(req);
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in again');

    const payload = verifyRefreshToken(token);
    if (!payload) {
      clearAuthCookies(res);
      throw new HttpError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: userInclude,
    });

    if (!user || user.disabledAt) {
      clearAuthCookies(res);
      throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in again');
    }

    issueCookies(res, user);
    return ok(res, {
      user: { ...publicUser(user), patient: user.patient, provider: user.provider },
    });
  })
);

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  setNoStore(res);
  audit(req, 'AUTH_LOGOUT', 'USER');
  return ok(res, { signedOut: true });
});

/** GET /api/auth/session */
router.get(
  '/session',
  authMiddleware,
  asyncHandler(async (req, res) => {
    setNoStore(res);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: userInclude,
    });

    if (!user || user.disabledAt) {
      clearAuthCookies(res);
      throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in again');
    }

    return ok(res, {
      user: { ...publicUser(user), patient: user.patient, provider: user.provider },
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Always generic: no account enumeration, and no email is actually sent in this
 * build. The response states that clearly instead of pretending.
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const body = parseBody(z.object({ email: emailSchema }), req);
    setNoStore(res);
    void body;
    return ok(res, {
      accepted: true,
      message:
        'If an account exists for that address, a reset link will be sent. Email delivery is not enabled in this deployment.',
    });
  })
);

export default router;
