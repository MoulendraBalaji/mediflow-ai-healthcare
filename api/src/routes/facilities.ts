import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, search, limit = '20' } = req.query;

    const where: any = {};
    if (type) where.facilityType = type;
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { address: { contains: search as string } },
      ];
    }

    const facilities = await prisma.facility.findMany({
      where,
      include: { providers: true },
      take: parseInt(limit as string),
    });

    res.json({ facilities, total: facilities.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch facilities', message: error.message });
  }
});

router.get('/nearby', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, limit = '10' } = req.query;

    const where: any = {};
    if (type) {
      const types = (type as string).split(',');
      where.facilityType = { in: types };
    }

    const facilities = await prisma.facility.findMany({
      where,
      include: {
        providers: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      take: parseInt(limit as string),
    });

    const formatted = facilities.map(f => ({
      id: f.id,
      name: f.name,
      type: f.facilityType,
      address: f.address,
      contactNumber: f.contactNumber,
      email: f.email,
      providerCount: f.providers.length,
      specialties: [...new Set(f.providers.map(p => p.specialty))],
    }));

    res.json({ facilities: formatted, total: formatted.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch nearby facilities', message: error.message });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const facility = await prisma.facility.findUnique({
      where: { id },
      include: {
        providers: true,
        _count: { select: { medicalRecords: true, appointments: true } },
      },
    });

    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    res.json(facility);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch facility', message: error.message });
  }
});

router.get('/emergency/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const emergencyFacilities = await prisma.facility.findMany({
      where: {
        OR: [
          { facilityType: 'Hospital' },
          { name: { contains: 'Urgent' } },
          { name: { contains: 'Emergency' } },
        ],
      },
      include: { providers: true },
    });

    res.json({ facilities: emergencyFacilities, total: emergencyFacilities.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch emergency facilities', message: error.message });
  }
});

export default router;
