import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound, ok, parseBody } from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertPatientAccess, requireRole, resolvePatientId } from '../middleware/access.js';
import { analyzeTimeline } from '../agents/timelineAgent.js';
import { navigateCare } from '../agents/navigatorAgent.js';
import { generateReminders } from '../agents/companionAgent.js';
import { generateHospitalAnalytics, generatePatientInsight } from '../agents/insightAgent.js';
import { withAgentRun } from '../services/agentRuns.js';
import { aiStatus } from '../services/groqService.js';
import { audit } from '../lib/audit.js';

const router = Router();

const patientBodySchema = z.object({
  patientId: z.string().trim().optional(),
});

const navigatorSchema = z.object({
  patientId: z.string().trim().optional(),
  symptoms: z.array(z.string().trim().min(1).max(200)).min(1, 'Describe at least one symptom').max(10),
  currentConditions: z.array(z.string().trim().max(160)).max(10).default([]),
});

/** GET /api/agents/status */
router.get(
  '/status',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    return ok(res, { ...aiStatus(), generatedAt: new Date().toISOString() });
  })
);

/** POST /api/agents/timeline/analyze */
router.post(
  '/timeline/analyze',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(patientBodySchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(patientId, 'TIMELINE', { patientId }, () => analyzeTimeline(patientId));
    return ok(res, run.output, { duration: run.duration, activityId: run.activityId });
  })
);

/** POST /api/agents/navigator/recommend */
router.post(
  '/navigator/recommend',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(navigatorSchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(
      patientId,
      'NAVIGATOR',
      { symptoms: body.symptoms, currentConditions: body.currentConditions },
      () => navigateCare(patientId, body.symptoms, body.currentConditions)
    );

    audit(req, 'RUN_NAVIGATOR', 'AGENT', patientId, { urgency: run.output.urgency });
    return ok(res, run.output, {
      duration: run.duration,
      activityId: run.activityId,
      disclaimer: run.output.disclaimer,
    });
  })
);

/** POST /api/agents/companion/generate */
router.post(
  '/companion/generate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(patientBodySchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(patientId, 'COMPANION', { patientId }, () =>
      generateReminders(patientId)
    );
    return ok(res, run.output, { duration: run.duration, activityId: run.activityId });
  })
);

/** POST /api/agents/insight/generate */
router.post(
  '/insight/generate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const body = parseBody(patientBodySchema, req);
    const patientId = resolvePatientId(req, body.patientId);
    await assertPatientAccess(req, patientId);

    const run = await withAgentRun(patientId, 'INSIGHT', { patientId }, () =>
      generatePatientInsight(patientId)
    );
    return ok(res, run.output, { duration: run.duration, activityId: run.activityId });
  })
);

/** GET /api/agents/insights/latest/:patientId */
router.get(
  '/insights/latest/:patientId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const patientId = resolvePatientId(req, req.params.patientId);
    await assertPatientAccess(req, patientId);

    const activity = await prisma.agentActivity.findFirst({
      where: { patientId, agentName: 'INSIGHT', status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, output: true, createdAt: true, duration: true },
    });

    if (!activity) throw notFound('No insight has been generated yet');

    return ok(res, {
      insight: activity.output,
      activityId: activity.id,
      generatedAt: activity.createdAt.toISOString(),
      duration: activity.duration,
    });
  })
);

/** GET /api/agents/insight/analytics — hospital-wide aggregates, staff only. */
router.get(
  '/insight/analytics',
  authMiddleware,
  requireRole('ADMIN', 'DOCTOR'),
  asyncHandler(async (req, res) => {
    const analytics = await generateHospitalAnalytics();
    audit(req, 'VIEW_ANALYTICS', 'ANALYTICS', null);
    return ok(res, analytics, { cached: analytics.cached });
  })
);

export default router;
