import { Router } from 'express';
import { ReminderStatus, ReminderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound, ok, parseBody, parseQuery, privateCache } from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertPatientAccess, resolvePatientId } from '../middleware/access.js';
import { generateReminders } from '../agents/companionAgent.js';
import { withAgentRun } from '../services/agentRuns.js';
import { audit } from '../lib/audit.js';

const router = Router();

const listQuerySchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createSchema = z.object({
  patientId: z.string().trim().optional(),
  reminderType: z.nativeEnum(ReminderType),
  title: z.string().trim().min(2, 'Add a title').max(180),
  description: z.string().trim().max(600).optional(),
  dueDate: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid due date'),
});

/** GET /api/reminders/patient/:patientId */
router.get(
  '/patient/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);
    const { status, limit } = parseQuery(listQuerySchema, req);

    const reminders = await prisma.reminder.findMany({
      where: { patientId, ...(status ? { status } : {}) },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    privateCache(res, 10);
    return ok(res, { reminders }, { total: reminders.length });
  })
);

/** POST /api/reminders */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(createSchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const reminder = await prisma.reminder.create({
      data: {
        patientId,
        reminderType: body.reminderType,
        title: body.title,
        description: body.description?.trim() || null,
        dueDate: new Date(body.dueDate),
        status: 'PENDING',
      },
    });

    audit(req, 'CREATE_REMINDER', 'REMINDER', patientId, { reminderId: reminder.id });
    return res.status(201).json({ data: { reminder } });
  })
);

/** POST /api/reminders/generate/:patientId */
router.post(
  '/generate/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(patientId, 'COMPANION', { patientId }, () =>
      generateReminders(patientId)
    );

    const toCreate = run.output.reminders.filter((reminder) => !reminder.existing);
    if (toCreate.length > 0) {
      await prisma.reminder.createMany({
        data: toCreate.map((reminder) => ({
          patientId,
          reminderType: reminder.reminderType,
          title: reminder.title,
          description: reminder.description,
          dueDate: new Date(reminder.dueDate),
          status: 'PENDING',
        })),
      });
    }

    audit(req, 'GENERATE_REMINDERS', 'REMINDER', patientId, { created: toCreate.length });
    return ok(res, { ...run.output, created: toCreate.length }, { duration: run.duration, activityId: run.activityId });
  })
);

/** GET /api/reminders/stats/:patientId */
router.get(
  '/stats/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const [groups, overdue] = await Promise.all([
      prisma.reminder.groupBy({
        by: ['status'],
        where: { patientId },
        _count: { _all: true },
      }),
      prisma.reminder.count({
        where: { patientId, status: 'PENDING', dueDate: { lt: new Date() } },
      }),
    ]);

    const counts: Record<string, number> = {
      PENDING: 0,
      SENT: 0,
      ACKNOWLEDGED: 0,
      DISMISSED: 0,
    };
    for (const group of groups) counts[group.status] = group._count._all;

    privateCache(res, 10);
    return ok(res, {
      pending: counts.PENDING,
      sent: counts.SENT,
      acknowledged: counts.ACKNOWLEDGED,
      dismissed: counts.DISMISSED,
      overdue,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    });
  })
);

/** PATCH /api/reminders/:id/acknowledge */
router.patch(
  '/:id/acknowledge',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const reminder = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!reminder) throw notFound('That reminder was not found');
    await assertPatientAccess(req, reminder.patientId);

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'ACKNOWLEDGED' },
    });

    audit(req, 'ACKNOWLEDGE_REMINDER', 'REMINDER', reminder.patientId, { reminderId: reminder.id });
    return ok(res, { reminder: updated });
  })
);

/** DELETE /api/reminders/:id */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const reminder = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!reminder) throw notFound('That reminder was not found');
    await assertPatientAccess(req, reminder.patientId);

    await prisma.reminder.delete({ where: { id: reminder.id } });
    audit(req, 'DELETE_REMINDER', 'REMINDER', reminder.patientId, { reminderId: reminder.id });
    return ok(res, { deleted: true, id: reminder.id });
  })
);

export default router;
