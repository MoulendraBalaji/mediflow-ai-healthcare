import { Router } from 'express';
import { AgentName, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound, ok, parseQuery } from '../lib/http.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertPatientAccess, resolvePatientId } from '../middleware/access.js';
import { audit } from '../lib/audit.js';

const router = Router();

const AGENT_LABELS: Record<AgentName, string> = {
  INTAKE: 'Intake',
  TIMELINE: 'Timeline',
  NAVIGATOR: 'Navigator',
  COMPANION: 'Companion',
  INSIGHT: 'Insight',
};

const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  INTAKE: 'Reads documents and extracts only what is printed',
  TIMELINE: 'Builds the chronology, gaps and duplicate checks',
  NAVIGATOR: 'Suggests a care pathway with red-flag triage',
  COMPANION: 'Turns the care plan into reminders and explanations',
  INSIGHT: 'Summarises recorded care without adding facts',
};

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function briefOutput(agentName: AgentName, status: string, output: Prisma.JsonValue | null): string {
  if (status === 'PROCESSING') return 'Still running.';
  if (status === 'FAILED') return 'This run failed. No clinical result was produced.';

  const data = asObject(output);
  if (!data) return 'Completed.';

  switch (agentName) {
    case 'INTAKE': {
      const medications = Array.isArray(data.medications) ? data.medications.length : 0;
      const diagnoses = Array.isArray(data.diagnoses) ? data.diagnoses.length : 0;
      return `Extracted ${medications} medicine(s) and ${diagnoses} diagnosis entry(ies) from the document.`;
    }
    case 'TIMELINE': {
      const stats = asObject(data.statistics as Prisma.JsonValue);
      const gaps = Number(stats?.gapCount ?? 0);
      const duplicates = Number(stats?.duplicateCount ?? 0);
      const conflicts = Number(stats?.conflictCount ?? 0);
      const issues = gaps + duplicates + conflicts;
      return issues > 0
        ? `Found ${issues} item(s) to review across gaps, duplicate courses and possible interactions.`
        : 'No gaps, duplicate courses or rule-based interactions were found.';
    }
    case 'NAVIGATOR': {
      const urgency = typeof data.urgency === 'string' ? data.urgency : 'UNKNOWN';
      const redFlags = Array.isArray(data.redFlags) ? data.redFlags.length : 0;
      return redFlags > 0
        ? `Emergency triage triggered (${urgency}). Warning signs: ${redFlags}.`
        : `Suggested a care pathway with ${urgency.toLowerCase()} urgency.`;
    }
    case 'COMPANION': {
      const reminders = Array.isArray(data.reminders) ? data.reminders.length : 0;
      const score = typeof data.careEngagementScore === 'number' ? data.careEngagementScore : null;
      return `Prepared ${reminders} reminder(s)${score === null ? '' : `; care-engagement score ${score}/100`}.`;
    }
    case 'INSIGHT': {
      const risk = typeof data.riskLevel === 'string' ? data.riskLevel : 'UNKNOWN';
      return `Generated a care insight (${risk.toLowerCase()} risk flag).`;
    }
    default:
      return 'Completed.';
  }
}

function formatActivity(activity: {
  id: string;
  agentName: AgentName;
  status: string;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  meta: Prisma.JsonValue | null;
  error: string | null;
  duration: number | null;
  createdAt: Date;
}) {
  return {
    id: activity.id,
    agentName: activity.agentName,
    label: AGENT_LABELS[activity.agentName],
    description: AGENT_DESCRIPTIONS[activity.agentName],
    status: activity.status,
    duration: activity.duration,
    createdAt: activity.createdAt.toISOString(),
    input: activity.input,
    output: activity.output,
    meta: activity.meta,
    // Error text is deliberately not echoed to patients; the status is enough.
    hasError: Boolean(activity.error),
    briefOutput: briefOutput(activity.agentName, activity.status, activity.output),
  };
}

/** GET /api/agent-activity?patientId=&limit=&offset= */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        patientId: z.string().trim().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      req
    );

    const patientId = resolvePatientId(req, query.patientId);
    await assertPatientAccess(req, patientId);

    const [activities, total] = await Promise.all([
      prisma.agentActivity.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.agentActivity.count({ where: { patientId } }),
    ]);

    audit(req, 'VIEW_AGENT_ACTIVITY', 'AGENT_ACTIVITY', patientId, { total });
    return ok(
      res,
      { activities: activities.map(formatActivity) },
      { total, limit: query.limit, offset: query.offset }
    );
  })
);

/** GET /api/agent-activity/:id */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const activity = await prisma.agentActivity.findUnique({ where: { id: req.params.id } });
    if (!activity) throw notFound('That agent run was not found');
    await assertPatientAccess(req, activity.patientId);

    audit(req, 'VIEW_AGENT_RUN', 'AGENT_ACTIVITY', activity.patientId, { activityId: activity.id });
    return ok(res, { activity: formatActivity(activity) });
  })
);

export default router;
