import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound, ok, parseQuery, privateCache } from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const listQuerySchema = z.object({
  type: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function formatFacility(facility: {
  id: string;
  name: string;
  facilityType: string;
  address: string;
  contactNumber: string | null;
  email: string | null;
  providers: Array<{ id: string; firstName: string; lastName: string; specialty: string }>;
}) {
  return {
    id: facility.id,
    name: facility.name,
    type: facility.facilityType,
    facilityType: facility.facilityType,
    address: facility.address,
    contactNumber: facility.contactNumber,
    email: facility.email,
    providerCount: facility.providers.length,
    specialties: [...new Set(facility.providers.map((provider) => provider.specialty))].sort(),
    providers: facility.providers,
  };
}

/** GET /api/facilities */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(listQuerySchema, req);
    const facilities = await prisma.facility.findMany({
      where: {
        ...(query.type ? { facilityType: { equals: query.type, mode: 'insensitive' } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { address: { contains: query.search, mode: 'insensitive' } },
                { facilityType: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        providers: {
          select: { id: true, firstName: true, lastName: true, specialty: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
      take: query.limit,
    });

    privateCache(res, 30);
    return ok(res, { facilities: facilities.map(formatFacility) }, { total: facilities.length });
  })
);

/** GET /api/facilities/nearby — no geolocation is collected, so this ranks by breadth of care. */
router.get(
  '/nearby',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        type: z.string().trim().max(60).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      }),
      req
    );

    const types = query.type
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const facilities = await prisma.facility.findMany({
      where: types && types.length > 0 ? { facilityType: { in: types, mode: 'insensitive' } } : {},
      include: {
        providers: {
          select: { id: true, firstName: true, lastName: true, specialty: true },
        },
      },
      take: 100,
    });

    const formatted = facilities
      .map(formatFacility)
      .sort((a, b) => b.providerCount - a.providerCount || a.name.localeCompare(b.name))
      .slice(0, query.limit);

    privateCache(res, 30);
    return ok(res, { facilities: formatted }, { total: formatted.length, rankedBy: 'provider-coverage' });
  })
);

/** GET /api/facilities/emergency/list */
router.get(
  '/emergency/list',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const facilities = await prisma.facility.findMany({
      where: {
        OR: [
          { facilityType: { equals: 'Hospital', mode: 'insensitive' } },
          { name: { contains: 'emergency', mode: 'insensitive' } },
          { name: { contains: 'urgent', mode: 'insensitive' } },
        ],
      },
      include: {
        providers: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: { name: 'asc' },
    });

    privateCache(res, 60);
    return ok(res, { facilities: facilities.map(formatFacility) }, { total: facilities.length });
  })
);

/** GET /api/facilities/:id */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const facility = await prisma.facility.findUnique({
      where: { id: req.params.id },
      include: {
        providers: {
          select: { id: true, firstName: true, lastName: true, specialty: true, contactNumber: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
        _count: { select: { medicalRecords: true, appointments: true } },
      },
    });
    if (!facility) throw notFound('That facility was not found');

    privateCache(res, 30);
    return ok(res, {
      facility: {
        ...formatFacility(facility),
        counts: {
          records: facility._count.medicalRecords,
          appointments: facility._count.appointments,
        },
      },
    });
  })
);

export default router;
