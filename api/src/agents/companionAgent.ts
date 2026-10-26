import type { ReminderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { aiChat, aiJson, AiUnavailableError, asData, DATA_ONLY_INSTRUCTION } from '../services/groqService.js';

export interface GeneratedReminder {
  key: string;
  reminderType: ReminderType;
  title: string;
  description: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  /** True when an equivalent PENDING reminder already exists for this patient. */
  existing: boolean;
}

export interface MissedAppointment {
  appointmentId: string;
  reason: string;
  date: string;
  providerName: string;
}

export interface CompanionResult {
  reminders: GeneratedReminder[];
  explanations: Record<string, string>;
  missedAppointments: MissedAppointment[];
  careEngagementScore: number;
  scoreBasis: string;
  aiSummary: string;
  mode: 'ai' | 'rule-based';
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function atEightAm(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(8, 0, 0, 0);
  if (copy.getTime() <= date.getTime()) copy.setDate(copy.getDate() + 1);
  return copy;
}

function fallbackExplanation(name: string, indication: string | null): string {
  return indication
    ? `${name} is a medicine your clinician prescribed for ${indication}. Take it exactly as printed on the label, and ask your pharmacist if you are unsure about a dose or side effect.`
    : `${name} is a medicine on your recorded plan. Take it exactly as printed on the label; your pharmacist can explain what it is for and what side effects to watch for.`;
}

const explanationSchema = z.object({
  explanations: z.record(z.string(), z.string()),
});

/**
 * Generate reminder candidates and plain-language explanations.
 *
 * The score is explicitly a care-engagement score (attendance + recorded plan),
 * not a claim about whether pills were swallowed. Reminders are deduplicated
 * against existing PENDING rows so repeated runs do not multiply tasks.
 */
export async function generateReminders(patientId: string): Promise<CompanionResult> {
  const now = new Date();
  const [patient, medications, appointments, existingReminders] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true },
    }),
    prisma.medication.findMany({
      where: { patientId, OR: [{ endDate: null }, { endDate: { gt: now } }] },
      orderBy: { startDate: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { patientId },
      include: {
        provider: { select: { firstName: true, lastName: true } },
        facility: { select: { name: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    }),
    prisma.reminder.findMany({
      where: { patientId, status: 'PENDING' },
      select: { reminderType: true, title: true },
    }),
  ]);

  if (!patient) throw new Error('Patient not found');

  const existingKeys = new Set(
    existingReminders.map((reminder) => `${reminder.reminderType}|${reminder.title.toLowerCase()}`)
  );

  const candidates: GeneratedReminder[] = [];
  const push = (reminder: Omit<GeneratedReminder, 'existing'>) => {
    const existing = existingKeys.has(`${reminder.reminderType}|${reminder.title.toLowerCase()}`);
    candidates.push({ ...reminder, existing });
  };

  for (const medication of medications) {
    const dose = [medication.dosage, medication.frequency].filter(Boolean).join(' · ');
    push({
      key: `medication:${medication.id}`,
      reminderType: 'MEDICATION',
      title: `Take ${medication.name}`,
      description: dose
        ? `${medication.name}${medication.dosage ? ` ${medication.dosage}` : ''}${
            medication.frequency ? ` — ${medication.frequency}` : ''
          }.${medication.indication ? ` Prescribed for ${medication.indication}.` : ''}`
        : `Take ${medication.name} as printed on the label.`,
      dueDate: atEightAm(now).toISOString(),
      priority: 'HIGH',
    });
  }

  const upcoming = appointments.filter(
    (appointment) => appointment.status === 'SCHEDULED' && appointment.appointmentDate >= now
  );
  for (const appointment of upcoming.slice(0, 5)) {
    const daysUntil = Math.ceil((appointment.appointmentDate.getTime() - now.getTime()) / DAY_MS);
    const clinician = `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`;
    push({
      key: `appointment:${appointment.id}`,
      reminderType: 'APPOINTMENT',
      title: `Appointment with ${clinician}`,
      description: `${appointment.reason || 'Scheduled visit'} at ${appointment.facility.name}, in ${daysUntil} day${
        daysUntil === 1 ? '' : 's'
      } (${appointment.appointmentTime}).`,
      dueDate: appointment.appointmentDate.toISOString(),
      priority: daysUntil <= 3 ? 'HIGH' : 'MEDIUM',
    });
  }

  const missed = appointments.filter(
    (appointment) => appointment.status === 'SCHEDULED' && appointment.appointmentDate < now
  );
  for (const appointment of missed.slice(0, 5)) {
    const clinician = `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`;
    push({
      key: `followup:${appointment.id}`,
      reminderType: 'FOLLOW_UP',
      title: `Reschedule visit with ${clinician}`,
      description: `The visit on ${appointment.appointmentDate.toISOString().slice(0, 10)} (${
        appointment.reason || 'no reason recorded'
      }) was not marked complete. Contact the clinic to rebook.`,
      dueDate: now.toISOString(),
      priority: 'HIGH',
    });
  }

  for (const medication of medications) {
    const refillDue =
      medication.refillDueDate ??
      (medication.endDate && medication.endDate <= addDays(now, 14) ? medication.endDate : null);
    if (!refillDue) continue;
    push({
      key: `refill:${medication.id}`,
      reminderType: 'REFILL',
      title: `Refill ${medication.name}`,
      description: `Your recorded supply or course for ${medication.name} ends around ${refillDue
        .toISOString()
        .slice(0, 10)}. Ask your clinician or pharmacist about a refill.`,
      dueDate: refillDue.toISOString(),
      priority: refillDue <= addDays(now, 7) ? 'HIGH' : 'MEDIUM',
    });
  }

  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  candidates.sort(
    (a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() ||
      priorityRank[a.priority] - priorityRank[b.priority]
  );

  // Explanations: one batched call, with deterministic text for any medicine
  // the model does not cover. Never asserts an unrecorded purpose.
  const explanations: Record<string, string> = {};
  const uniqueMeds = [...new Map(medications.map((med) => [med.name.toLowerCase(), med])).values()].slice(0, 12);
  for (const medication of uniqueMeds) {
    explanations[medication.name] = fallbackExplanation(medication.name, medication.indication);
  }

  try {
    if (uniqueMeds.length > 0) {
      const result = await aiJson(explanationSchema, {
        task: 'explain',
        system: `Explain medicines in plain language for a patient. For each medicine, say what it is commonly used for and one practical safety point. Keep each entry to 1-2 sentences. Do not diagnose, change doses, or invent indications. If the recorded indication is "not recorded", say the purpose is not recorded and to ask the prescriber. ${DATA_ONLY_INSTRUCTION} Respond with {"explanations": {"medicine name": "text"}}.`,
        user: uniqueMeds
          .map((medication) => `${medication.name} — recorded indication: ${medication.indication || 'not recorded'}`)
          .join('\n'),
        maxTokens: 1200,
        cache: true,
      });

      for (const medication of uniqueMeds) {
        const key = Object.keys(result.value.explanations).find(
          (candidate) => candidate.toLowerCase() === medication.name.toLowerCase()
        );
        const text = key ? result.value.explanations[key]?.trim() : undefined;
        if (text) explanations[medication.name] = text;
      }
    }
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) {
      logger.warn({ err: error }, 'medicine explanation failed');
    }
  }

  const completed = appointments.filter((appointment) => appointment.status === 'COMPLETED').length;
  const noShow = appointments.filter((appointment) => appointment.status === 'NOSHOW').length;
  const attendedOrMissed = completed + noShow + missed.length;
  const attendanceRatio = attendedOrMissed > 0 ? completed / attendedOrMissed : null;
  const base = attendanceRatio === null ? 70 : 40 + attendanceRatio * 60;
  const score = Math.max(
    0,
    Math.min(100, Math.round(base - Math.min(20, (noShow + missed.length) * 5) + (medications.length > 0 ? 5 : 0)))
  );

  const scoreBasis = `Based on ${completed} completed, ${noShow + missed.length} missed visit(s)${
    attendedOrMissed === 0 ? ' (no visit history recorded yet)' : ''
  } and ${medications.length} active medicine(s). It does not measure doses actually taken.`;

  let aiSummary = `${patient.firstName} has ${medications.length} active medicine${
    medications.length === 1 ? '' : 's'
  } and ${upcoming.length} upcoming appointment${upcoming.length === 1 ? '' : 's'}. ${
    missed.length > 0
      ? `${missed.length} past visit${missed.length === 1 ? '' : 's'} should be rescheduled.`
      : 'No overdue visits are recorded.'
  }`;
  let mode: 'ai' | 'rule-based' = 'rule-based';

  try {
    const result = await aiChat({
      task: 'summary',
      messages: [
        {
          role: 'system',
          content:
            'Write a short, calm care summary for a patient. Use 2-3 sentences. Do not invent symptoms, doses or adherence. Do not give new medical advice. State only the supplied facts.',
        },
        {
          role: 'user',
          content: `Active medicines: ${medications.map((med) => med.name).join(', ') || 'none'}. Upcoming appointments: ${upcoming.length}. Overdue visits: ${missed.length}. Care-engagement score: ${score}/100.`,
        },
      ],
      maxTokens: 300,
      cache: true,
    });
    aiSummary = result.content.trim();
    mode = 'ai';
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) {
      logger.warn({ err: error }, 'companion summary failed');
    }
  }

  return {
    reminders: candidates,
    explanations,
    missedAppointments: missed.map((appointment) => ({
      appointmentId: appointment.id,
      reason: appointment.reason || 'No reason recorded',
      date: appointment.appointmentDate.toISOString(),
      providerName: `Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}`,
    })),
    careEngagementScore: score,
    scoreBasis,
    aiSummary,
    mode,
    generatedAt: new Date().toISOString(),
  };
}
