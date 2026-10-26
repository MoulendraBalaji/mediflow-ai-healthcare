import { Router } from 'express';
import { AppointmentStatus, Urgency } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  asyncHandler,
  HttpError,
  notFound,
  ok,
  parseBody,
  parseQuery,
  privateCache,
  unprocessable,
} from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertPatientAccess, resolvePatientId } from '../middleware/access.js';
import { audit } from '../lib/audit.js';

const router = Router();

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), 'Enter a valid date');

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, for example 14:30');

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.nativeEnum(AppointmentStatus).optional(),
});

const createSchema = z.object({
  patientId: z.string().trim().optional(),
  providerId: z.string().trim().min(1, 'Choose a clinician'),
  facilityId: z.string().trim().optional(),
  appointmentDate: dateSchema,
  appointmentTime: timeSchema,
  reason: z.string().trim().max(500).optional(),
  urgency: z.nativeEnum(Urgency).optional(),
});

const rescheduleSchema = z.object({
  appointmentDate: dateSchema,
  appointmentTime: timeSchema,
  reason: z.string().trim().max(500).optional(),
});

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function ensureSlotFree(
  providerId: string,
  appointmentDate: Date,
  appointmentTime: string,
  ignoreId?: string
): Promise<void> {
  const clash = await prisma.appointment.findFirst({
    where: {
      providerId,
      appointmentDate,
      appointmentTime,
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new HttpError(409, 'SLOT_TAKEN', 'That time is already booked with this clinician. Choose another slot.');
  }
}

/** GET /api/appointments/patient/:patientId */
router.get(
  '/patient/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);
    const { limit, offset, status } = parseQuery(listQuerySchema, req);

    const where = { patientId, ...(status ? { status } : {}) };
    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          facility: { select: { id: true, name: true, facilityType: true, address: true } },
        },
        orderBy: [{ appointmentDate: 'desc' }, { appointmentTime: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.appointment.count({ where }),
    ]);

    privateCache(res, 10);
    audit(req, 'VIEW_APPOINTMENTS', 'APPOINTMENT', patientId, { total });
    return ok(res, { appointments }, { total, limit, offset });
  })
);

/** GET /api/appointments/providers/available */
router.get(
  '/providers/available',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        specialty: z.string().trim().max(80).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      req
    );

    const providers = await prisma.provider.findMany({
      where: {
        ...(query.specialty
          ? { specialty: { contains: query.specialty, mode: 'insensitive' as const } }
          : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' as const } },
                { lastName: { contains: query.search, mode: 'insensitive' as const } },
                { specialty: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { facility: { select: { id: true, name: true, facilityType: true, address: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: query.limit,
    });

    privateCache(res, 30);
    return ok(res, { providers }, { total: providers.length });
  })
);

/** GET /api/appointments/slots?providerId=&date= */
router.get(
  '/slots',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        providerId: z.string().trim().min(1),
        date: dateSchema,
      }),
      req
    );

    const provider = await prisma.provider.findUnique({
      where: { id: query.providerId },
      select: { id: true, facilityId: true },
    });
    if (!provider) throw notFound('That clinician was not found');

    const day = utcDate(query.date);
    const booked = await prisma.appointment.findMany({
      where: {
        providerId: provider.id,
        appointmentDate: day,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
      },
      select: { appointmentTime: true },
    });
    const taken = new Set(booked.map((appointment) => appointment.appointmentTime));

    const todayKey = dateKey(new Date());
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const slots: Array<{ time: string; available: boolean; reason: string | null }> = [];

    for (let minutes = 9 * 60; minutes <= 16 * 60 + 30; minutes += 30) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mins = String(minutes % 60).padStart(2, '0');
      const time = `${hours}:${mins}`;
      const isPast = query.date === todayKey && minutes <= nowMinutes;
      const isTaken = taken.has(time);
      slots.push({
        time,
        available: !isPast && !isTaken,
        reason: isTaken ? 'Booked' : isPast ? 'Past' : null,
      });
    }

    return ok(res, { providerId: provider.id, date: query.date, slots });
  })
);

/** POST /api/appointments */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(createSchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const provider = await prisma.provider.findUnique({
      where: { id: body.providerId },
      select: { id: true, facilityId: true },
    });
    if (!provider) throw unprocessable('That clinician was not found');

    const appointmentDate = utcDate(body.appointmentDate);
    if (appointmentDate.getTime() < utcDate(dateKey(new Date())).getTime()) {
      throw unprocessable('Choose today or a future date');
    }

    const facilityId = provider.facilityId;
    if (body.facilityId && body.facilityId !== facilityId) {
      throw unprocessable('The clinician does not work at that facility');
    }

    await ensureSlotFree(provider.id, appointmentDate, body.appointmentTime);

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        providerId: provider.id,
        facilityId,
        appointmentDate,
        appointmentTime: body.appointmentTime,
        status: 'SCHEDULED',
        reason: body.reason?.trim() || null,
        urgency: body.urgency ?? 'MEDIUM',
      },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        facility: { select: { id: true, name: true, facilityType: true, address: true } },
      },
    });

    audit(req, 'CREATE_APPOINTMENT', 'APPOINTMENT', patientId, { appointmentId: appointment.id });
    return res.status(201).json({ data: { appointment } });
  })
);

/** PATCH /api/appointments/:id/cancel */
router.patch(
  '/:id/cancel',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) throw notFound('That appointment was not found');
    await assertPatientAccess(req, appointment.patientId);

    if (appointment.status === 'CANCELLED') {
      return ok(res, { appointment, alreadyCancelled: true });
    }
    if (appointment.status === 'COMPLETED') {
      throw new HttpError(409, 'ALREADY_COMPLETED', 'A completed visit cannot be cancelled. Contact the clinic.');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        facility: { select: { id: true, name: true } },
      },
    });

    audit(req, 'CANCEL_APPOINTMENT', 'APPOINTMENT', appointment.patientId, { appointmentId: updated.id });
    return ok(res, { appointment: updated });
  })
);

/** PATCH /api/appointments/:id/reschedule */
router.patch(
  '/:id/reschedule',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(rescheduleSchema, req);
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment) throw notFound('That appointment was not found');
    await assertPatientAccess(req, appointment.patientId);

    if (appointment.status === 'COMPLETED') {
      throw new HttpError(409, 'ALREADY_COMPLETED', 'A completed visit cannot be rescheduled.');
    }

    const newDate = utcDate(body.appointmentDate);
    if (newDate.getTime() < utcDate(dateKey(new Date())).getTime()) {
      throw unprocessable('Choose today or a future date');
    }
    await ensureSlotFree(appointment.providerId, newDate, body.appointmentTime, appointment.id);

    const previous = `${dateKey(appointment.appointmentDate)} ${appointment.appointmentTime}`;
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        appointmentDate: newDate,
        appointmentTime: body.appointmentTime,
        status: 'SCHEDULED',
        cancelledAt: null,
        rescheduledFrom: previous,
        ...(body.reason ? { reason: body.reason } : {}),
      },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        facility: { select: { id: true, name: true } },
      },
    });

    audit(req, 'RESCHEDULE_APPOINTMENT', 'APPOINTMENT', appointment.patientId, {
      appointmentId: updated.id,
      previous,
    });
    return ok(res, { appointment: updated });
  })
);

/** GET /api/appointments/:id */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        facility: { select: { id: true, name: true, facilityType: true, address: true } },
      },
    });
    if (!appointment) throw notFound('That appointment was not found');
    await assertPatientAccess(req, appointment.patientId);
    return ok(res, { appointment });
  })
);

export default router;
