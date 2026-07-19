import { prisma } from '../index.js';

export interface TimelineGap {
  type: string;
  date: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface DuplicateRecord {
  name: string;
  dates: string[];
  count: number;
}

export interface DrugConflict {
  drug1: string;
  drug2: string;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface TimelineAnalysis {
  sortedEvents: Array<any>;
  gaps: TimelineGap[];
  duplicates: DuplicateRecord[];
  conflicts: DrugConflict[];
  narrativeSummary: string;
  statistics: {
    totalRecords: number;
    gapCount: number;
    duplicateCount: number;
    conflictCount: number;
  };
}

// Hardcoded drug-drug conflict rules
const DRUG_CONFLICTS: Array<{ drug1: string; drug2: string; reason: string; severity: string }> = [
  {
    drug1: 'Metformin',
    drug2: 'Contrast dye',
    reason: 'Risk of lactic acidosis; contraindicated with IV contrast',
    severity: 'critical',
  },
  {
    drug1: 'Lisinopril',
    drug2: 'Potassium supplements',
    reason: 'Risk of hyperkalemia',
    severity: 'warning',
  },
  {
    drug1: 'Warfarin',
    drug2: 'NSAIDs',
    reason: 'Increased bleeding risk',
    severity: 'warning',
  },
  {
    drug1: 'ACE Inhibitors',
    drug2: 'NSAIDs',
    reason: 'Reduced antihypertensive effect; renal function impairment',
    severity: 'warning',
  },
];

/**
 * Analyze patient's medical timeline
 */
export async function analyzeTimeline(patientId: string): Promise<TimelineAnalysis> {
  try {
    // Fetch all patient medical records
    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        medications: true,
        provider: true,
        facility: true,
      },
      orderBy: { recordDate: 'asc' },
    });

    // Fetch patient medications
    const medications = await prisma.medication.findMany({
      where: { patientId },
      orderBy: { startDate: 'asc' },
    });

    // Sort events chronologically
    const sortedEvents = records.map((record) => ({
      id: record.id,
      date: record.recordDate,
      type: record.recordType,
      description: record.description,
      provider: record.provider,
      facility: record.facility?.name,
      medications: record.medications,
    }));

    // Detect gaps (>180 days between visits)
    const gaps: TimelineGap[] = [];
    const GAP_THRESHOLD = 180 * 24 * 60 * 60 * 1000; // 180 days in milliseconds

    for (let i = 1; i < sortedEvents.length; i++) {
      const prevDate = new Date(sortedEvents[i - 1].date).getTime();
      const currDate = new Date(sortedEvents[i].date).getTime();
      const gapMs = currDate - prevDate;

      if (gapMs > GAP_THRESHOLD) {
        gaps.push({
          type: 'No documented contact',
          date: sortedEvents[i - 1].date.toISOString().split('T')[0],
          severity: gapMs > 365 * 24 * 60 * 60 * 1000 ? 'high' : 'medium',
          description: `${Math.floor(gapMs / (24 * 60 * 60 * 1000))} days without recorded visit`,
        });
      }
    }

    // Detect duplicate medications (same name, different dates)
    const medicationMap = new Map<string, string[]>();
    medications.forEach((med) => {
      const key = med.name.toLowerCase();
      if (!medicationMap.has(key)) {
        medicationMap.set(key, []);
      }
      medicationMap.get(key)!.push(med.startDate.toISOString().split('T')[0]);
    });

    const duplicates: DuplicateRecord[] = [];
    medicationMap.forEach((dates, name) => {
      if (dates.length > 1) {
        duplicates.push({
          name,
          dates,
          count: dates.length,
        });
      }
    });

    // Detect drug-drug conflicts
    const conflicts: DrugConflict[] = [];
    const activeMeds = medications
      .filter((m) => !m.endDate || m.endDate > new Date())
      .map((m) => m.name.toLowerCase());

    DRUG_CONFLICTS.forEach((conflict) => {
      const drug1Match = activeMeds.some((m) => m.includes(conflict.drug1.toLowerCase()));
      const drug2Match = activeMeds.some((m) => m.includes(conflict.drug2.toLowerCase()));

      if (drug1Match && drug2Match) {
        conflicts.push({
          drug1: conflict.drug1,
          drug2: conflict.drug2,
          reason: conflict.reason,
          severity: conflict.severity as 'warning' | 'critical',
        });
      }
    });

    // Generate narrative summary
    const narrativeSummary = generateNarrativeSummary(
      records,
      medications,
      gaps,
      duplicates,
      conflicts
    );

    return {
      sortedEvents,
      gaps,
      duplicates,
      conflicts,
      narrativeSummary,
      statistics: {
        totalRecords: records.length,
        gapCount: gaps.length,
        duplicateCount: duplicates.length,
        conflictCount: conflicts.length,
      },
    };
  } catch (error) {
    console.error('Error analyzing timeline:', error);
    throw error;
  }
}

/**
 * Generate plain-language narrative summary of medical history
 */
function generateNarrativeSummary(
  records: any[],
  medications: any[],
  gaps: TimelineGap[],
  duplicates: DuplicateRecord[],
  conflicts: DrugConflict[]
): string {
  const lines: string[] = [];

  // First section: Overview
  lines.push(
    `This patient has ${records.length} documented medical records spanning from ${records[0]?.recordDate ? new Date(records[0].recordDate).toLocaleDateString() : 'unknown'} to ${records[records.length - 1]?.recordDate ? new Date(records[records.length - 1].recordDate).toLocaleDateString() : 'unknown'}.`
  );

  // Second section: Current medications
  const activeMeds = medications.filter((m) => !m.endDate || m.endDate > new Date());
  if (activeMeds.length > 0) {
    lines.push(
      `The patient is currently on ${activeMeds.length} medication(s): ${activeMeds.map((m) => m.name).join(', ')}.`
    );
  }

  // Third section: Issues
  if (gaps.length > 0) {
    lines.push(
      `⚠️ Care coordination concern: There are ${gaps.length} period(s) with no documented medical contact exceeding 6 months.`
    );
  }

  if (duplicates.length > 0) {
    lines.push(
      `⚠️ Medication management issue: ${duplicates.map((d) => `${d.name} appears ${d.count} times`).join('; ')}.`
    );
  }

  if (conflicts.length > 0) {
    lines.push(
      `⚠️ Drug interaction alert: ${conflicts.map((c) => `${c.drug1} + ${c.drug2}`).join('; ')} may interact.`
    );
  }

  // Final note
  if (gaps.length === 0 && duplicates.length === 0 && conflicts.length === 0) {
    lines.push('No major care coordination or medication management issues detected at this time.');
  }

  return lines.join(' ');
}
