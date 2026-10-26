import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

/**
 * Audit trail for read/write access to patient data.
 * Never throws: an audit failure must not fail a clinical request.
 */
export function audit(
  req: Request,
  action: string,
  resource: string,
  patientId?: string | null,
  metadata?: Record<string, unknown>
): void {
  const user = req.user;
  prisma.auditLog
    .create({
      data: {
        actorUserId: user?.userId ?? null,
        patientId: patientId ?? null,
        action,
        resource,
        requestId: req.requestId ?? null,
        ip: req.ip ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })
    .catch((error: unknown) => {
      logger.warn({ err: error }, 'audit write failed');
    });
}
