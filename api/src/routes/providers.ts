import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  asyncHandler,
  notFound,
  ok,
  parseBody,
  parseQuery,
  privateCache,
  unprocessable,
} from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertPatientAccess, doctorProviderId, requireRole, resolvePatientId } from '../middleware/access.js';
import { audit } from '../lib/audit.js';
import { aiChat, AiUnavailableError, asData, DATA_ONLY_INSTRUCTION } from '../services/groqService.js';
import { navigateCare } from '../agents/navigatorAgent.js';
import { generatePatientInsight } from '../agents/insightAgent.js';
import { withAgentRun } from '../services/agentRuns.js';

const router = Router();

function ageBand(dateOfBirth: Date): string {
  const age = Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) return 'Under 18';
  if (age < 40) return '18–39';
  if (age < 65) return '40–64';
  return '65+';
}

function stringsFromJson(value: unknown): string[] {
  if (!value) return [];
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const candidate = record.allergies ?? record.diagnoses;
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is string => typeof item === 'string');
    }
  }
  return [];
}

/** GET /api/providers — directory of clinicians. */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        specialty: z.string().trim().max(80).optional(),
        search: z.string().trim().max(120).optional(),
        facilityId: z.string().trim().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      req
    );

    const providers = await prisma.provider.findMany({
      where: {
        ...(query.specialty
          ? { specialty: { contains: query.specialty, mode: 'insensitive' as const } }
          : {}),
        ...(query.facilityId ? { facilityId: query.facilityId } : {}),
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

/** GET /api/providers/me/patients — patients linked to the signed-in clinician. */
router.get(
  '/me/patients',
  authMiddleware,
  requireRole('DOCTOR'),
  asyncHandler(async (req, res) => {
    const providerId = doctorProviderId(req);
    const now = new Date();

    const [grants, appointments, records] = await Promise.all([
      prisma.accessGrant.findMany({
        where: {
          providerId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { patientId: true },
      }),
      prisma.appointment.findMany({
        where: { providerId },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
      prisma.medicalRecord.findMany({
        where: { providerId, deletedAt: null },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
    ]);

    const patientIds = [...new Set([...grants, ...appointments, ...records].map((row) => row.patientId))];

    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        contactNumber: true,
        _count: { select: { medicalRecords: true, appointments: true, medications: true } },
        appointments: {
          where: { status: 'SCHEDULED', appointmentDate: { gte: now } },
          orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
          take: 1,
          select: { id: true, appointmentDate: true, appointmentTime: true, reason: true, urgency: true },
        },
        medicalRecords: {
          where: { deletedAt: null },
          orderBy: { recordDate: 'desc' },
          take: 1,
          select: { recordDate: true, recordType: true, description: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    privateCache(res, 15);
    audit(req, 'VIEW_PANEL', 'PATIENT', null, { count: patients.length });
    return ok(
      res,
      {
        patients: patients.map((patient) => ({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          ageBand: ageBand(patient.dateOfBirth),
          gender: patient.gender,
          contactNumber: patient.contactNumber,
          counts: {
            records: patient._count.medicalRecords,
            appointments: patient._count.appointments,
            activeMedications: patient._count.medications,
          },
          nextAppointment: patient.appointments[0] ?? null,
          latestRecord: patient.medicalRecords[0] ?? null,
        })),
      },
      { total: patients.length }
    );
  })
);

/** GET /api/providers/patient/:patientId/summary */
router.get(
  '/patient/:patientId/summary',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        medications: { orderBy: { startDate: 'desc' } },
        appointments: {
          include: {
            provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
            facility: { select: { id: true, name: true } },
          },
          orderBy: { appointmentDate: 'desc' },
          take: 10,
        },
        medicalRecords: {
          where: { deletedAt: null },
          include: {
            provider: { select: { id: true, firstName: true, lastName: true } },
            facility: { select: { id: true, name: true } },
            medications: true,
          },
          orderBy: { recordDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) throw notFound('That patient was not found');

    const now = new Date();
    const activeMedications = patient.medications.filter(
      (medication) => !medication.endDate || medication.endDate > now
    );

    const allergies = new Set<string>();
    const diagnoses = new Set<string>();
    for (const record of patient.medicalRecords) {
      const extracted = record.extractedData as Record<string, unknown> | null;
      if (!extracted || typeof extracted !== 'object') continue;
      for (const allergy of stringsFromJson(extracted.allergies)) allergies.add(allergy);
      for (const diagnosis of stringsFromJson(extracted.diagnoses)) diagnoses.add(diagnosis);
    }

    const band = ageBand(patient.dateOfBirth);
    const facts = [
      `Age band: ${band}`,
      `Gender: ${patient.gender}`,
      `Allergies: ${[...allergies].join(', ') || 'none recorded'}`,
      `Recorded diagnoses: ${[...diagnoses].join(', ') || 'none recorded'}`,
      `Active medicines: ${
        activeMedications.map((medication) => medication.name).join(', ') || 'none recorded'
      }`,
      `Recent visits: ${patient.appointments
        .slice(0, 5)
        .map((appointment) => `${appointment.status.toLowerCase()} ${appointment.appointmentDate.toISOString().slice(0, 10)}`)
        .join('; ') || 'none recorded'}`,
    ];

    let summary = `${band} patient with ${activeMedications.length} active medicine(s), ${
      patient.appointments.length
    } recorded visit(s) and ${patient.medicalRecords.length} recent document(s). Allergies: ${
      [...allergies].join(', ') || 'none recorded'
    }.`;
    let mode: 'ai' | 'rule-based' = 'rule-based';

    try {
      const result = await aiChat({
        task: 'summary',
        messages: [
          {
            role: 'system',
            content: `You write a concise pre-consultation summary for a clinician. Use only the supplied facts. Do not invent diagnoses, doses, test results or adherence. Do not repeat direct identifiers. ${DATA_ONLY_INSTRUCTION} 3-5 sentences.`,
          },
          { role: 'user', content: facts.join('\n') },
        ],
        maxTokens: 450,
        cache: true,
      });
      summary = result.content.trim();
      mode = 'ai';
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
    }

    audit(req, 'VIEW_PATIENT_SUMMARY', 'PATIENT', patientId);

    return ok(res, {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        ageBand: band,
        contactNumber: patient.contactNumber,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
      },
      activeMedications,
      allergies: [...allergies],
      diagnoses: [...diagnoses],
      recentRecords: patient.medicalRecords,
      recentAppointments: patient.appointments,
      summary,
      mode,
      generatedAt: new Date().toISOString(),
    });
  })
);

/** POST /api/providers/translate — cached medical translation. */
router.post(
  '/translate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        text: z.string().trim().min(1, 'Add text to translate').max(8000),
        language: z.string().trim().min(2).max(40).default('Spanish'),
        patientId: z.string().trim().optional(),
      }),
      req
    );

    if (body.patientId) {
      const patientId = resolvePatientId(req, body.patientId);
      await assertPatientAccess(req, patientId);
    }

    try {
      const result = await aiChat({
        task: 'translate',
        messages: [
          {
            role: 'system',
            content: `Translate medical text into ${body.language}. Use plain, respectful language for a lay reader. Preserve medicine names, doses, numbers and warnings exactly. Do not add advice or omit warnings. ${DATA_ONLY_INSTRUCTION}`,
          },
          { role: 'user', content: asData('TEXT_TO_TRANSLATE', body.text) },
        ],
        temperature: 0.1,
        maxTokens: 1600,
        cache: true,
      });

      return ok(res, {
        original: body.text,
        translated: result.content.trim(),
        language: body.language,
        available: true,
        mode: 'ai',
        cached: result.cached,
      });
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      return ok(res, {
        original: body.text,
        translated: null,
        language: body.language,
        available: false,
        mode: 'unavailable',
        message:
          'Translation is unavailable right now. The original text has been left unchanged and nothing was invented.',
      });
    }
  })
);

/** POST /api/providers/explain-prescription */
router.post(
  '/explain-prescription',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        text: z.string().trim().min(1, 'Paste prescription text or directions').max(8000),
        language: z.string().trim().max(40).default('English'),
        patientId: z.string().trim().optional(),
      }),
      req
    );

    if (body.patientId) {
      const patientId = resolvePatientId(req, body.patientId);
      await assertPatientAccess(req, patientId);
    }

    try {
      const result = await aiChat({
        task: 'explain',
        messages: [
          {
            role: 'system',
            content: `Explain the supplied prescription text in plain ${body.language}. Cover: what each medicine is commonly used for, how the label says to take it, and important safety points to ask a pharmacist about. Use only what is written. Do not invent a diagnosis or change a dose. If something is unclear, say it is unclear. ${DATA_ONLY_INSTRUCTION}`,
          },
          { role: 'user', content: asData('PRESCRIPTION_TEXT', body.text) },
        ],
        temperature: 0.2,
        maxTokens: 1400,
        cache: true,
      });

      return ok(res, {
        original: body.text,
        explanation: result.content.trim(),
        language: body.language,
        available: true,
        mode: 'ai',
        cached: result.cached,
      });
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) throw error;
      return ok(res, {
        original: body.text,
        explanation:
          'A plain-language explanation is unavailable right now. Please read the printed label exactly as written and ask your pharmacist or prescriber about anything that is unclear. No explanation has been generated.',
        language: body.language,
        available: false,
        mode: 'rule-based',
        message: 'The AI explainer is offline; this is a safety message, not a medical explanation.',
      });
    }
  })
);

/** POST /api/providers/navigator — legacy alias for the Navigator agent. */
router.post(
  '/navigator',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        patientId: z.string().trim().optional(),
        symptoms: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
        currentConditions: z.array(z.string().trim().max(160)).max(10).optional(),
      }),
      req
    );
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(patientId, 'NAVIGATOR', { symptoms: body.symptoms }, () =>
      navigateCare(patientId, body.symptoms, body.currentConditions ?? [])
    );
    return ok(res, run.output, { duration: run.duration, activityId: run.activityId });
  })
);

/** POST /api/providers/insight/:patientId — legacy alias for the Insight agent. */
router.post(
  '/insight/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);
    const run = await withAgentRun(patientId, 'INSIGHT', { patientId }, () =>
      generatePatientInsight(patientId)
    );
    return ok(res, run.output, { duration: run.duration, activityId: run.activityId });
  })
);

export default router;
