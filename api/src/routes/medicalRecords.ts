import { Router } from 'express';
import multer from 'multer';
import { Prisma, RecordType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  asyncHandler,
  badRequest,
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
import {
  extractDocument,
  extractionErrorMessage,
  extractionErrorStatus,
  normaliseRecordType,
  type ExtractionResult,
} from '../services/intakeService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const recordTypeSchema = z.nativeEnum(RecordType);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: recordTypeSchema.optional(),
});

const medicationInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(100).nullish(),
  frequency: z.string().trim().max(200).nullish(),
  indication: z.string().trim().max(300).nullish(),
  prescribedBy: z.string().trim().max(200).nullish(),
  startDate: z.string().trim().nullish(),
  endDate: z.string().trim().nullish(),
});

const saveRecordSchema = z.object({
  patientId: z.string().trim().optional(),
  providerId: z.string().trim().nullish(),
  facilityId: z.string().trim().optional(),
  recordType: recordTypeSchema,
  recordDate: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid record date'),
  description: z.string().trim().min(2, 'Add a short description').max(2000),
  fileName: z.string().trim().max(200).nullish(),
  filePath: z.string().trim().max(500).nullish(),
  extractedData: z.unknown().optional(),
  medications: z.array(medicationInputSchema).max(80).default([]),
});

function dateOr(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function resolveFacility(facilityId: string | undefined, facilityName: string | null): Promise<string> {
  if (facilityId) {
    const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } });
    if (!facility) throw unprocessable('That facility was not found');
    return facility.id;
  }

  if (facilityName) {
    const match = await prisma.facility.findFirst({
      where: { name: { equals: facilityName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (match) return match.id;
  }

  const fallback = await prisma.facility.findFirst({ orderBy: { name: 'asc' }, select: { id: true } });
  if (!fallback) {
    throw unprocessable('No facility is configured yet. Ask an administrator to add one before saving records.');
  }
  return fallback.id;
}

async function resolveProvider(
  req: Parameters<typeof assertPatientAccess>[0],
  providerId: string | null | undefined,
  extractedName: string | null
): Promise<string | null> {
  if (providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } });
    if (!provider) throw unprocessable('That clinician was not found');
    return provider.id;
  }

  if (req.user?.role === 'DOCTOR' && req.user.providerId) return req.user.providerId;

  if (extractedName) {
    const cleaned = extractedName.replace(/^dr\.?\s+/i, '').trim();
    const [firstName, ...rest] = cleaned.split(/\s+/);
    if (firstName && rest.length > 0) {
      const provider = await prisma.provider.findFirst({
        where: {
          firstName: { equals: firstName, mode: 'insensitive' },
          lastName: { equals: rest.join(' '), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (provider) return provider.id;
    }
  }

  return null;
}

/** GET /api/medical-records/patient/:patientId */
router.get(
  '/patient/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);
    const { limit, offset, type } = parseQuery(listQuerySchema, req);

    const where = { patientId, deletedAt: null, ...(type ? { recordType: type } : {}) };

    const [records, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where,
        include: {
          provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          facility: { select: { id: true, name: true, facilityType: true } },
          medications: true,
        },
        orderBy: { recordDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    privateCache(res, 15);
    audit(req, 'VIEW_RECORDS', 'MEDICAL_RECORD', patientId, { total });
    return ok(res, { records }, { total, limit, offset });
  })
);

/** GET /api/medical-records/medications/:patientId */
router.get(
  '/medications/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const medications = await prisma.medication.findMany({
      where: { patientId },
      include: {
        record: { select: { id: true, recordDate: true, recordType: true, description: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const now = new Date();
    const active = medications.filter((medication) => !medication.endDate || medication.endDate > now);
    const inactive = medications.filter((medication) => medication.endDate && medication.endDate <= now);

    privateCache(res, 15);
    return ok(res, { active, inactive }, { total: medications.length });
  })
);

/** GET /api/medical-records/:patientId/dashboard-metrics */
router.get(
  '/:patientId/dashboard-metrics',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      completedConsultations,
      pendingAppointments,
      activeMedications,
      upcomingFollowUps,
      recordsUploaded,
      pendingReminders,
      nextAppointment,
      latestRecord,
    ] = await Promise.all([
      prisma.appointment.count({ where: { patientId, status: 'COMPLETED' } }),
      prisma.appointment.count({
        where: { patientId, status: 'SCHEDULED', appointmentDate: { gte: now } },
      }),
      prisma.medication.count({
        where: { patientId, OR: [{ endDate: null }, { endDate: { gt: now } }] },
      }),
      prisma.appointment.count({
        where: {
          patientId,
          status: 'SCHEDULED',
          appointmentDate: { gte: now, lte: inThirtyDays },
        },
      }),
      prisma.medicalRecord.count({ where: { patientId, deletedAt: null } }),
      prisma.reminder.count({ where: { patientId, status: 'PENDING' } }),
      prisma.appointment.findFirst({
        where: { patientId, status: 'SCHEDULED', appointmentDate: { gte: now } },
        include: {
          provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          facility: { select: { id: true, name: true } },
        },
        orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
      }),
      prisma.medicalRecord.findFirst({
        where: { patientId, deletedAt: null },
        select: { id: true, recordDate: true, recordType: true, description: true },
        orderBy: { recordDate: 'desc' },
      }),
    ]);

    privateCache(res, 10);
    return ok(res, {
      completedConsultations,
      pendingAppointments,
      activeMedications,
      upcomingFollowUps,
      recordsUploaded,
      pendingReminders,
      nextAppointment,
      latestRecord,
      generatedAt: new Date().toISOString(),
    });
  })
);

/** GET /api/medical-records/:patientId/timeline-preview */
router.get(
  '/:patientId/timeline-preview',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);
    const { limit } = parseQuery(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req);

    const [records, medications] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { patientId, deletedAt: null },
        include: {
          medications: true,
          provider: { select: { id: true, firstName: true, lastName: true } },
          facility: { select: { id: true, name: true } },
        },
        orderBy: { recordDate: 'desc' },
        take: limit,
      }),
      prisma.medication.findMany({ where: { patientId }, select: { name: true } }),
    ]);

    const counts = new Map<string, number>();
    for (const medication of medications) {
      const key = medication.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicateFlags = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name);

    privateCache(res, 15);
    return ok(res, { records, duplicateFlags }, { recordCount: records.length });
  })
);

// ---------------------------------------------------------------------------
// Extraction (draft, no database write) and save
// ---------------------------------------------------------------------------

async function handleExtract(
  req: Parameters<typeof assertPatientAccess>[0] & { file?: Express.Multer.File },
  res: Parameters<typeof ok>[0]
): Promise<unknown> {
  if (!req.file) throw badRequest('Attach a PDF, image or text file first.');

  const patientId = resolvePatientId(req, typeof req.body?.patientId === 'string' ? req.body.patientId : null);
  await assertPatientAccess(req, patientId);

  const requested = normaliseRecordType(req.body?.recordType);

  let extraction: ExtractionResult;
  try {
    extraction = await extractDocument(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype },
      requested
    );
  } catch (error) {
    const status = extractionErrorStatus(error);
    const message = extractionErrorMessage(error);
    const code = status === 503 ? 'EXTRACTION_UNAVAILABLE' : status === 400 ? 'BAD_DOCUMENT' : 'EXTRACTION_FAILED';
    return res.status(status).json({
      error: { code, message, requestId: (req as { requestId?: string }).requestId },
    });
  }

  audit(req, 'EXTRACT_DOCUMENT', 'MEDICAL_RECORD', patientId, {
    needsOcr: extraction.needsOcr,
    extractor: extraction.extractor,
    demo: extraction.demo,
  });

  return ok(res, { extraction }, { patientId });
}

/** POST /api/medical-records/extract — preview only; nothing is persisted. */
router.post('/extract', authMiddleware, upload.single('file'), asyncHandler(handleExtract));

/** POST /api/medical-records/upload — legacy alias for extract (never writes). */
router.post('/upload', authMiddleware, upload.single('file'), asyncHandler(handleExtract));

/** POST /api/medical-records — save a reviewed extraction in one transaction. */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(saveRecordSchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const recordDate = new Date(body.recordDate);
    const extracted = (body.extractedData ?? null) as Record<string, unknown> | null;

    const facilityName =
      extracted && typeof extracted.facilityName === 'string' ? extracted.facilityName : null;
    const extractedProvider =
      extracted && typeof extracted.providerName === 'string' ? extracted.providerName : null;

    const facilityId = await resolveFacility(body.facilityId, facilityName);
    const providerId = await resolveProvider(req, body.providerId, extractedProvider);

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.medicalRecord.create({
        data: {
          patientId,
          providerId,
          facilityId,
          recordType: body.recordType,
          recordDate,
          description: body.description,
          fileName: body.fileName ?? null,
          filePath: body.filePath ?? null,
          extractedData:
            extracted === null ? Prisma.JsonNull : (extracted as Prisma.InputJsonValue),
        },
        select: { id: true },
      });

      if (body.medications.length > 0) {
        await tx.medication.createMany({
          data: body.medications.map((medication) => ({
            patientId,
            recordId: created.id,
            name: medication.name,
            dosage: medication.dosage?.trim() || null,
            frequency: medication.frequency?.trim() || null,
            indication: medication.indication?.trim() || null,
            prescribedBy: medication.prescribedBy?.trim() || null,
            startDate: dateOr(medication.startDate, recordDate),
            endDate: medication.endDate ? dateOr(medication.endDate, recordDate) : null,
          })),
        });
      }

      return tx.medicalRecord.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
          facility: { select: { id: true, name: true, facilityType: true } },
          medications: true,
        },
      });
    });

    audit(req, 'CREATE_RECORD', 'MEDICAL_RECORD', patientId, { recordId: record.id });
    return res.status(201).json({ data: { record } });
  })
);

/** GET /api/medical-records/:id */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const record = await prisma.medicalRecord.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        facility: { select: { id: true, name: true, facilityType: true } },
        medications: true,
      },
    });
    if (!record) throw notFound('That record was not found');
    await assertPatientAccess(req, record.patientId);
    audit(req, 'VIEW_RECORD', 'MEDICAL_RECORD', record.patientId, { recordId: record.id });
    return ok(res, { record });
  })
);

/** DELETE /api/medical-records/:id — soft delete. */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const existing = await prisma.medicalRecord.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true, patientId: true },
    });
    if (!existing) throw notFound('That record was not found');
    await assertPatientAccess(req, existing.patientId);

    await prisma.medicalRecord.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    audit(req, 'DELETE_RECORD', 'MEDICAL_RECORD', existing.patientId, { recordId: existing.id });
    return ok(res, { deleted: true, id: existing.id });
  })
);

export default router;
