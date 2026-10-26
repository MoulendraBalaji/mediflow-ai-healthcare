import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { forbidden, notFound, unauthorized } from '../lib/http.js';

/**
 * Resolve which patient a request is about.
 *
 * Patients always act on themselves: any body/query patientId is ignored and
 * their token's patientId is used instead.
 */
export function resolvePatientId(req: Request, requested?: string | null): string {
  const user = req.user;
  if (!user) throw unauthorized();

  if (user.role === 'PATIENT') {
    if (!user.patientId) throw forbidden('This account is not linked to a patient record');
    return user.patientId;
  }

  const patientId = requested?.trim();
  if (!patientId) throw notFound();
  return patientId;
}

async function doctorCanAccessPatient(providerId: string, patientId: string): Promise<boolean> {
  const now = new Date();
  const [grant, appointment, record] = await Promise.all([
    prisma.accessGrant.findFirst({
      where: {
        patientId,
        providerId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: { patientId, providerId },
      select: { id: true },
    }),
    prisma.medicalRecord.findFirst({
      where: { patientId, providerId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  // Patients can also grant a doctor write/read access via AccessGrant; for
  // now the presence of a clinical relationship is enough (spec A5).
  return Boolean(grant || appointment || record);
}

/**
 * Throws 404 (not 403) when the caller may not see the patient, so the API
 * never reveals whether a patient record exists.
 */
export async function assertPatientAccess(req: Request, patientId: string): Promise<void> {
  const user = req.user;
  if (!user) throw unauthorized();

  if (user.role === 'ADMIN') return;

  if (user.role === 'PATIENT') {
    if (!user.patientId || user.patientId !== patientId) throw notFound();
    return;
  }

  if (user.role === 'DOCTOR') {
    if (!user.providerId) throw notFound();
    const allowed = await doctorCanAccessPatient(user.providerId, patientId);
    if (!allowed) throw notFound();
    return;
  }

  throw notFound();
}

/** Throws 404 unless the caller may access the row's patient. */
export async function assertRowAccess(req: Request, rowPatientId: string): Promise<void> {
  return assertPatientAccess(req, rowPatientId);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Please sign in again', requestId: req.requestId },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this resource',
          requestId: req.requestId,
        },
      });
    }
    return next();
  };
}

export function doctorProviderId(req: Request): string {
  const user = req.user;
  if (!user || user.role !== 'DOCTOR' || !user.providerId) {
    throw forbidden('A clinician profile is required');
  }
  return user.providerId;
}
