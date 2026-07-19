import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Get patient's appointments
 */
router.get('/patient/:patientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status, limit = '50', offset = '0' } = req.query;

    const where: any = { patientId };
    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        provider: true,
        facility: true,
      },
      orderBy: { appointmentDate: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.appointment.count({ where });

    res.json({
      appointments,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments', message: error.message });
  }
});

/**
 * Create appointment request
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, providerId, facilityId, appointmentDate, appointmentTime, urgency, reason } =
      req.body;

    if (!patientId || !providerId || !facilityId || !appointmentDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        providerId,
        facilityId,
        appointmentDate: new Date(appointmentDate),
        appointmentTime: appointmentTime || '10:00 AM',
        status: 'Scheduled',
        reason,
        urgency: urgency || 'Medium',
      },
      include: {
        provider: true,
        facility: true,
      },
    });

    res.status(201).json({
      message: 'Appointment created successfully',
      appointment,
    });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment', message: error.message });
  }
});

/**
 * Get available providers
 */
router.get('/providers/available', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        facility: true,
      },
      take: 20,
    });

    res.json(providers);
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers', message: error.message });
  }
});

export default router;
