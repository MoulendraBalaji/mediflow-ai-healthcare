import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { generateReminders } from '../agents/companionAgent.js';

const router = Router();

router.get('/patient/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;

    const where: any = { patientId };
    if (status) where.status = status;

    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: { dueDate: 'asc' },
    });

    res.json({ reminders, total: reminders.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch reminders', message: error.message });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, reminderType, title, description, dueDate } = req.body;

    if (!patientId || !reminderType || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const reminder = await prisma.reminder.create({
      data: {
        patientId,
        reminderType,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        status: 'Pending',
      },
    });

    res.status(201).json({ message: 'Reminder created', reminder });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create reminder', message: error.message });
  }
});

router.patch('/:id/acknowledge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reminder = await prisma.reminder.update({
      where: { id },
      data: { status: 'Acknowledged' },
    });
    res.json({ message: 'Reminder acknowledged', reminder });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to acknowledge reminder', message: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.reminder.delete({ where: { id } });
    res.json({ message: 'Reminder deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete reminder', message: error.message });
  }
});

router.post('/generate/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { patientId } = req.params;
    const result = await generateReminders(patientId);

    for (const rem of result.reminders) {
      const existing = await prisma.reminder.findFirst({
        where: {
          patientId,
          title: rem.title,
          status: 'Pending',
        },
      });

      if (!existing) {
        await prisma.reminder.create({
          data: {
            patientId,
            reminderType: rem.reminderType,
            title: rem.title,
            description: rem.description,
            dueDate: new Date(rem.dueDate),
            status: 'Pending',
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    await prisma.agentActivity.create({
      data: {
        patientId,
        agentName: 'Companion',
        status: 'Completed',
        input: JSON.stringify({ patientId }),
        output: JSON.stringify(result),
        duration,
      },
    });

    res.json({ success: true, data: result, duration });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate reminders', message: error.message });
  }
});

router.get('/stats/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    const pending = await prisma.reminder.count({ where: { patientId, status: 'Pending' } });
    const sent = await prisma.reminder.count({ where: { patientId, status: 'Sent' } });
    const acknowledged = await prisma.reminder.count({ where: { patientId, status: 'Acknowledged' } });
    const overdue = await prisma.reminder.count({
      where: {
        patientId,
        status: 'Pending',
        dueDate: { lt: new Date() },
      },
    });

    res.json({ pending, sent, acknowledged, overdue, total: pending + sent + acknowledged });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

export default router;
