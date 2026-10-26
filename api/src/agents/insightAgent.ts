import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { aiJson, AiUnavailableError, DATA_ONLY_INSTRUCTION } from '../services/groqService.js';

export interface PatientInsight {
  patientId: string;
  careEngagementScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  recommendations: string[];
  metrics: {
    activeMedications: number;
    completedVisits: number;
    upcomingVisits: number;
    missedVisits: number;
    records: number;
    careGaps: number;
  };
  mode: 'ai' | 'rule-based';
  generatedAt: string;
}

export interface HospitalAnalytics {
  totalPatients: number;
  totalAppointments: number;
  missedFollowUpRate: number;
  averageAppointmentsPerPatient: number;
  upcomingAppointmentCount: number;
  appointmentBottlenecks: Array<{
    providerId: string;
    providerName: string;
    specialty: string;
    pendingCount: number;
  }>;
  complianceBreakdown: {
    compliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    noHistory: number;
  };
  treatmentTimelines: Array<{
    patientId: string;
    patientName: string;
    treatment: string;
    startDate: string;
    durationDays: number;
    status: string;
  }>;
  generatedAt: string;
  cached: boolean;
}

const insightSchema = z.object({
  summary: z.string().min(20).max(900),
  recommendations: z.array(z.string().min(3).max(240)).min(1).max(6),
});

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function defaultRecommendations(metrics: PatientInsight['metrics'], firstName: string): string[] {
  const recommendations: string[] = [];
  if (metrics.missedVisits > 0) {
    recommendations.push('Contact the clinic to reschedule the overdue visit(s) on your timeline.');
  }
  if (metrics.careGaps > 0) {
    recommendations.push('Ask your clinician whether a follow-up is due after the recorded care gap.');
  }
  if (metrics.activeMedications > 0) {
    recommendations.push('Bring your current medicine list to your next visit and ask about any duplicates.');
  }
  if (metrics.records < 2) {
    recommendations.push('Upload a recent prescription or report so the clinical picture is complete.');
  }
  recommendations.push(
    `Keep ${firstName}'s care plan current by confirming upcoming appointments and any outstanding tests.`
  );
  return recommendations.slice(0, 5);
}

/**
 * Patient-facing insight built from recorded counts. The model may rewrite the
 * prose, but it receives only aggregates and cannot add clinical facts.
 */
export async function generatePatientInsight(patientId: string): Promise<PatientInsight> {
  const now = new Date();
  const [patient, statusGroups, activeMedications, records, latestRecords] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { patientId },
      _count: { _all: true },
    }),
    prisma.medication.count({
      where: { patientId, OR: [{ endDate: null }, { endDate: { gt: now } }] },
    }),
    prisma.medicalRecord.count({ where: { patientId, deletedAt: null } }),
    prisma.medicalRecord.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { recordDate: 'desc' },
      select: { recordDate: true },
      take: 2,
    }),
  ]);

  if (!patient) throw new Error('Patient not found');

  const countFor = (status: string): number =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  const completedVisits = countFor('COMPLETED');
  const upcomingVisits = await prisma.appointment.count({
    where: { patientId, status: 'SCHEDULED', appointmentDate: { gte: now } },
  });
  const missedVisits =
    countFor('NOSHOW') +
    (await prisma.appointment.count({
      where: { patientId, status: 'SCHEDULED', appointmentDate: { lt: now } },
    }));

  const lastRecord = latestRecords[0]?.recordDate;
  const previousRecord = latestRecords[1]?.recordDate;
  const daysSinceLast = lastRecord
    ? Math.round((now.getTime() - lastRecord.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const gapBetween =
    lastRecord && previousRecord
      ? Math.round((lastRecord.getTime() - previousRecord.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
  const careGaps =
    (daysSinceLast !== null && daysSinceLast > 180 ? 1 : 0) + (gapBetween > 180 ? 1 : 0);

  const attended = completedVisits + missedVisits;
  const attendanceRatio = attended > 0 ? completedVisits / attended : null;
  const careEngagementScore = clamp(
    Math.round(
      (attendanceRatio === null ? 70 : 40 + attendanceRatio * 60) -
        Math.min(25, missedVisits * 5) +
        (activeMedications > 0 ? 5 : 0)
    )
  );

  const riskLevel: PatientInsight['riskLevel'] =
    missedVisits >= 3 || careGaps >= 2
      ? 'HIGH'
      : missedVisits >= 1 || careGaps === 1
        ? 'MEDIUM'
        : 'LOW';

  const metrics = {
    activeMedications,
    completedVisits,
    upcomingVisits,
    missedVisits,
    records,
    careGaps,
  };

  const summary = `${patient.firstName} has ${activeMedications} active medicine${
    activeMedications === 1 ? '' : 's'
  }, ${records} recorded document${records === 1 ? '' : 's'} and ${completedVisits} completed visit${
    completedVisits === 1 ? '' : 's'
  }. ${
    missedVisits > 0
      ? `${missedVisits} visit${missedVisits === 1 ? '' : 's'} appear overdue or missed.`
      : 'No overdue visits are recorded.'
  }${
    daysSinceLast === null
      ? ' No clinical record date is available yet.'
      : ` The most recent record is ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} old.`
  } This score reflects attendance and recorded plan, not doses actually taken.`;

  let finalSummary = summary;
  let recommendations = defaultRecommendations(metrics, patient.firstName);
  let mode: 'ai' | 'rule-based' = 'rule-based';

  try {
    const result = await aiJson(insightSchema, {
      task: 'summary',
      system: `You summarise recorded care for a patient in calm, plain language. Use only the supplied aggregates. Do not invent symptoms, diagnoses, doses, adherence or test results. Do not give new treatment advice. ${DATA_ONLY_INSTRUCTION} Respond with {"summary": string, "recommendations": [string]}.`,
      user: [
        `Active medicines: ${activeMedications}`,
        `Completed visits: ${completedVisits}`,
        `Upcoming visits: ${upcomingVisits}`,
        `Overdue/missed visits: ${missedVisits}`,
        `Recorded documents: ${records}`,
        `Care gaps over 180 days: ${careGaps}`,
        `Days since most recent record: ${daysSinceLast ?? 'unknown'}`,
        `Deterministic care-engagement score: ${careEngagementScore}`,
      ].join('\n'),
      maxTokens: 600,
      cache: true,
    });
    finalSummary = result.value.summary.trim();
    recommendations = result.value.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 5);
    mode = 'ai';
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) {
      logger.warn({ err: error }, 'patient insight generation failed');
    }
  }

  return {
    patientId,
    careEngagementScore,
    riskLevel,
    summary: finalSummary,
    recommendations,
    metrics,
    mode,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Hospital analytics (aggregate, no patient-identifying AI calls)
// ---------------------------------------------------------------------------

let analyticsCache: { expiresAt: number; value: HospitalAnalytics } | null = null;

export async function generateHospitalAnalytics(): Promise<HospitalAnalytics> {
  const now = Date.now();
  if (analyticsCache && analyticsCache.expiresAt > now) {
    return { ...analyticsCache.value, cached: true };
  }

  const nowDate = new Date();
  const [totalPatients, statusGroups, appointmentGroups, scheduledByProvider, recentRecords] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['patientId', 'status'],
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ['providerId'],
      where: { status: 'SCHEDULED', appointmentDate: { gte: nowDate } },
      _count: { _all: true },
      orderBy: { _count: { providerId: 'desc' } },
      take: 5,
    }),
    prisma.medicalRecord.findMany({
      where: { deletedAt: null },
      orderBy: { recordDate: 'desc' },
      take: 10,
      select: {
        patientId: true,
        recordDate: true,
        description: true,
        recordType: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const statusCount = (status: string): number =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  const totalAppointments = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const noShow = statusCount('NOSHOW');
  const cancelled = statusCount('CANCELLED');

  const upcomingAppointmentCount = await prisma.appointment.count({
    where: { status: 'SCHEDULED', appointmentDate: { gte: nowDate } },
  });

  const missedAppointments = noShow + cancelled;
  const missedFollowUpRate =
    totalAppointments > 0 ? Math.round((missedAppointments / totalAppointments) * 100) : 0;
  const averageAppointmentsPerPatient =
    totalPatients > 0 ? Math.round((totalAppointments / totalPatients) * 10) / 10 : 0;

  // Compliance by patient, using recorded visit status only.
  const perPatient = new Map<string, { total: number; missed: number }>();
  for (const group of appointmentGroups) {
    const entry = perPatient.get(group.patientId) ?? { total: 0, missed: 0 };
    entry.total += group._count._all;
    if (group.status === 'NOSHOW' || group.status === 'CANCELLED') entry.missed += group._count._all;
    perPatient.set(group.patientId, entry);
  }

  let compliant = 0;
  let partiallyCompliant = 0;
  let nonCompliant = 0;
  for (const entry of perPatient.values()) {
    const ratio = entry.total > 0 ? entry.missed / entry.total : 0;
    if (ratio <= 0.1) compliant += 1;
    else if (ratio <= 0.4) partiallyCompliant += 1;
    else nonCompliant += 1;
  }
  const noHistory = Math.max(0, totalPatients - perPatient.size);

  const providerIds = scheduledByProvider.map((group) => group.providerId);
  const providers = await prisma.provider.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, firstName: true, lastName: true, specialty: true },
  });
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));

  const analytics: HospitalAnalytics = {
    totalPatients,
    totalAppointments,
    missedFollowUpRate,
    averageAppointmentsPerPatient,
    upcomingAppointmentCount,
    appointmentBottlenecks: scheduledByProvider.map((group) => {
      const provider = providerMap.get(group.providerId);
      return {
        providerId: group.providerId,
        providerName: provider ? `Dr. ${provider.firstName} ${provider.lastName}` : 'Unknown clinician',
        specialty: provider?.specialty ?? 'Unknown',
        pendingCount: group._count._all,
      };
    }),
    complianceBreakdown: { compliant, partiallyCompliant, nonCompliant, noHistory },
    treatmentTimelines: recentRecords.map((record) => ({
      patientId: record.patientId,
      patientName: `${record.patient.firstName} ${record.patient.lastName}`,
      treatment: record.description.slice(0, 160),
      startDate: record.recordDate.toISOString().slice(0, 10),
      durationDays: Math.max(
        0,
        Math.round((nowDate.getTime() - record.recordDate.getTime()) / (24 * 60 * 60 * 1000))
      ),
      status: record.recordType,
    })),
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  analyticsCache = { expiresAt: now + 60_000, value: analytics };
  return analytics;
}
