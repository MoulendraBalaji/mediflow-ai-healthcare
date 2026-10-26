import { prisma } from '../lib/prisma.js';

export interface TimelineGap {
  type: 'BETWEEN_RECORDS' | 'ONGOING';
  startDate: string;
  endDate: string;
  days: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface DuplicateRecord {
  name: string;
  dates: string[];
  count: number;
  overlapping: boolean;
  note: string;
}

export interface DrugConflict {
  drug1: string;
  drug2: string;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  description: string;
  providerName: string | null;
  facilityName: string | null;
  fileName: string | null;
  medications: Array<{ id: string; name: string; dosage: string | null; frequency: string | null }>;
}

export interface TimelineAnalysis {
  sortedEvents: TimelineEvent[];
  gaps: TimelineGap[];
  duplicates: DuplicateRecord[];
  conflicts: DrugConflict[];
  narrativeSummary: string;
  statistics: {
    totalRecords: number;
    gapCount: number;
    duplicateCount: number;
    conflictCount: number;
    spanDays: number;
  };
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GAP_DAYS = 180;

interface ConflictRule {
  left: { label: string; terms: string[] };
  right: { label: string; terms: string[] };
  reason: string;
  severity: 'warning' | 'critical';
}

// A deliberately small, explicit interaction list. It is decision support, not
// a complete interaction database, and it never creates a prescription.
const CONFLICT_RULES: ConflictRule[] = [
  {
    left: { label: 'ACE inhibitor', terms: ['lisinopril', 'enalapril', 'ramipril', 'perindopril', 'captopril'] },
    right: { label: 'NSAID', terms: ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'aspirin'] },
    reason: 'ACE inhibitors with NSAIDs can reduce kidney function and blunt blood-pressure control.',
    severity: 'warning',
  },
  {
    left: { label: 'Warfarin', terms: ['warfarin'] },
    right: { label: 'NSAID', terms: ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin'] },
    reason: 'Warfarin with NSAIDs increases the risk of serious bleeding.',
    severity: 'critical',
  },
  {
    left: { label: 'Metformin', terms: ['metformin'] },
    right: { label: 'Contrast dye', terms: ['contrast', 'iodinated contrast'] },
    reason: 'Metformin with iodinated contrast can increase the risk of lactic acidosis.',
    severity: 'critical',
  },
  {
    left: { label: 'Potassium supplement', terms: ['potassium chloride', 'potassium supplement', 'kcl'] },
    right: { label: 'ACE inhibitor', terms: ['lisinopril', 'enalapril', 'ramipril', 'perindopril'] },
    reason: 'Potassium supplements with ACE inhibitors can cause high potassium.',
    severity: 'warning',
  },
  {
    left: { label: 'SSRI', terms: ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram'] },
    right: { label: 'Triptan', terms: ['sumatriptan', 'rizatriptan', 'zolmitriptan'] },
    reason: 'SSRIs with triptans can increase serotonin-related side effects.',
    severity: 'warning',
  },
  {
    left: { label: 'Methotrexate', terms: ['methotrexate'] },
    right: { label: 'NSAID', terms: ['ibuprofen', 'naproxen', 'diclofenac'] },
    reason: 'NSAIDs can reduce methotrexate clearance and increase toxicity.',
    severity: 'critical',
  },
];

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / DAY_MS));
}

function findGaps(events: TimelineEvent[]): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  const now = new Date();

  for (let index = 1; index < events.length; index += 1) {
    const previous = new Date(events[index - 1].date);
    const current = new Date(events[index].date);
    const days = daysBetween(previous, current);
    if (days <= GAP_DAYS) continue;
    gaps.push({
      type: 'BETWEEN_RECORDS',
      startDate: iso(previous),
      endDate: iso(current),
      days,
      severity: days > 365 ? 'high' : 'medium',
      description: `${days} days passed with no documented clinical contact.`,
    });
  }

  const last = events.at(-1);
  if (last) {
    const lastDate = new Date(last.date);
    const days = daysBetween(lastDate, now);
    if (days > GAP_DAYS) {
      gaps.push({
        type: 'ONGOING',
        startDate: iso(lastDate),
        endDate: iso(now),
        days,
        severity: days > 365 ? 'high' : 'medium',
        description: `No documented clinical contact for ${days} days, including today.`,
      });
    }
  }

  return gaps;
}

function findDuplicates(
  medications: Array<{ name: string; startDate: Date; endDate: Date | null }>
): DuplicateRecord[] {
  const groups = new Map<string, Array<{ name: string; startDate: Date; endDate: Date | null }>>();
  for (const medication of medications) {
    const key = normaliseName(medication.name);
    const list = groups.get(key);
    if (list) list.push(medication);
    else groups.set(key, [medication]);
  }

  const duplicates: DuplicateRecord[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;

    let overlapping = false;
    for (let i = 0; i < list.length && !overlapping; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const aEnd = a.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const bEnd = b.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
        if (a.startDate.getTime() <= bEnd && b.startDate.getTime() <= aEnd) {
          overlapping = true;
          break;
        }
      }
    }

    duplicates.push({
      name: list[0].name,
      dates: list.map((medication) => iso(medication.startDate)).sort(),
      count: list.length,
      overlapping,
      note: overlapping
        ? 'The same medicine appears in overlapping prescriptions. Ask a clinician or pharmacist to confirm the intended regimen.'
        : 'The same medicine appears in separate prescriptions over time. Confirm which course is current.',
    });
  }

  return duplicates.sort((a, b) => b.count - a.count);
}

function findConflicts(
  medications: Array<{ name: string }>
): DrugConflict[] {
  const active = medications.map((medication) => normaliseName(medication.name));
  const conflicts: DrugConflict[] = [];
  const seen = new Set<string>();

  for (const rule of CONFLICT_RULES) {
    const left = active.find((name) => rule.left.terms.some((term) => name.includes(term)));
    const right = active.find((name) => rule.right.terms.some((term) => name.includes(term)));
    if (!left || !right) continue;

    const key = `${left}|${right}`;
    if (seen.has(key)) continue;
    seen.add(key);

    conflicts.push({
      drug1: left,
      drug2: right,
      reason: rule.reason,
      severity: rule.severity,
    });
  }

  return conflicts;
}

function buildNarrative(
  events: TimelineEvent[],
  activeMedications: Array<{ name: string; dosage: string | null; frequency: string | null }>,
  gaps: TimelineGap[],
  duplicates: DuplicateRecord[],
  conflicts: DrugConflict[]
): string {
  if (events.length === 0) {
    return 'No clinical records have been added yet, so there is no timeline to review. Upload a document or ask your clinic for a summary to begin.';
  }

  const first = new Date(events[0].date);
  const last = new Date(events.at(-1)!.date);
  const paragraphs: string[] = [];

  paragraphs.push(
    `${events.length} documented record${events.length === 1 ? '' : 's'} between ${iso(first)} and ${iso(last)} (${daysBetween(first, last)} days).`
  );

  if (activeMedications.length > 0) {
    const names = activeMedications
      .slice(0, 6)
      .map((medication) => `${medication.name}${medication.dosage ? ` ${medication.dosage}` : ''}`)
      .join(', ');
    paragraphs.push(
      `${activeMedications.length} active medicine${activeMedications.length === 1 ? '' : 's'} recorded: ${names}${
        activeMedications.length > 6 ? ', among others' : ''
      }.`
    );
  } else {
    paragraphs.push('No active medicines are recorded.');
  }

  if (gaps.length === 0) {
    paragraphs.push('There are no documented care gaps longer than six months.');
  } else {
    const ongoing = gaps.some((gap) => gap.type === 'ONGOING');
    paragraphs.push(
      `${gaps.length} care gap${gaps.length === 1 ? '' : 's'} longer than six months ${
        gaps.length === 1 ? 'was' : 'were'
      } found${ongoing ? ', including one that continues to today' : ''}.`
    );
  }

  if (duplicates.length > 0) {
    paragraphs.push(
      `${duplicates.length} medicine${duplicates.length === 1 ? '' : 's'} appear in more than one prescription${
        duplicates.some((duplicate) => duplicate.overlapping) ? ', including overlapping courses' : ''
      }.`
    );
  }

  if (conflicts.length > 0) {
    paragraphs.push(
      `${conflicts.length} possible interaction${conflicts.length === 1 ? '' : 's'} detected by the rule set. This is a prompt to review, not a confirmed interaction.`
    );
  }

  if (gaps.length === 0 && duplicates.length === 0 && conflicts.length === 0) {
    paragraphs.push('No gaps, duplicate courses or rule-based interactions were detected in the recorded data.');
  }

  return paragraphs.join(' ');
}

/**
 * Build a chronological timeline with deterministic gap, duplicate and
 * interaction checks. No model is involved, so the output is reproducible.
 */
export async function analyzeTimeline(patientId: string): Promise<TimelineAnalysis> {
  const now = new Date();
  const [records, medications] = await Promise.all([
    prisma.medicalRecord.findMany({
      where: { patientId, deletedAt: null },
      include: {
        medications: true,
        provider: { select: { firstName: true, lastName: true } },
        facility: { select: { name: true } },
      },
      orderBy: { recordDate: 'asc' },
    }),
    prisma.medication.findMany({
      where: { patientId },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const sortedEvents: TimelineEvent[] = records.map((record) => ({
    id: record.id,
    date: record.recordDate.toISOString(),
    type: record.recordType,
    description: record.description,
    providerName: record.provider ? `Dr. ${record.provider.firstName} ${record.provider.lastName}` : null,
    facilityName: record.facility?.name ?? null,
    fileName: record.fileName,
    medications: record.medications.map((medication) => ({
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
    })),
  }));

  const gaps = findGaps(sortedEvents);
  const duplicates = findDuplicates(medications);
  const activeMedications = medications.filter(
    (medication) => !medication.endDate || medication.endDate > now
  );
  const conflicts = findConflicts(activeMedications);

  return {
    sortedEvents,
    gaps,
    duplicates,
    conflicts,
    narrativeSummary: buildNarrative(sortedEvents, activeMedications, gaps, duplicates, conflicts),
    statistics: {
      totalRecords: sortedEvents.length,
      gapCount: gaps.length,
      duplicateCount: duplicates.length,
      conflictCount: conflicts.length,
      spanDays:
        sortedEvents.length > 1
          ? daysBetween(new Date(sortedEvents[0].date), new Date(sortedEvents.at(-1)!.date))
          : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
