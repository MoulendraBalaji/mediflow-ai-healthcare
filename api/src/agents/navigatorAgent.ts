import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { aiJson, AiUnavailableError, asData, DATA_ONLY_INSTRUCTION, sanitizeUserText } from '../services/groqService.js';

export type NavigatorUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface SpecialistRecommendation {
  specialty: string;
  department: string;
  reason: string;
  urgency: NavigatorUrgency;
  confidence: number;
}

export interface NavigatorFacility {
  id: string;
  name: string;
  type: string;
  address: string;
  contactNumber: string | null;
  reason: string;
  specialties: string[];
}

export interface NavigatorResult {
  urgency: NavigatorUrgency;
  redFlags: string[];
  recommendations: SpecialistRecommendation[];
  suggestedFacilities: NavigatorFacility[];
  carePathway: string[];
  aiExplanation: string;
  disclaimer: string;
  mode: 'ai' | 'rule-based';
  triageSource: 'red-flag' | 'symptom-map' | 'general';
  generatedAt: string;
}

export const NAVIGATOR_DISCLAIMER =
  'This is general wayfinding guidance, not a diagnosis or a substitute for a clinician. If symptoms are severe, sudden or getting worse, seek emergency care now.';

const EMERGENCY_NUMBER = env.EMERGENCY_NUMBER;

// Deterministic triage runs before any model call. These phrases are treated
// as emergencies even if the model would have said otherwise.
const RED_FLAGS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bchest pain\b|\bcrushing chest\b|\bpressure in (my|the) chest\b/, label: 'Chest pain' },
  { pattern: /\bcan(?:no|')t breathe\b|\bcannot breathe\b|\bnot breathing\b|\bstopped breathing\b/, label: 'Cannot breathe' },
  { pattern: /\bshortness of breath\b|\bdifficulty breathing\b|\bstruggling to breathe\b|\bgasping\b/, label: 'Severe breathing difficulty' },
  { pattern: /\bface droop|\bslurred speech\b|\bsudden weakness\b|\bnumb(ness)? on one side\b|\bstroke\b/, label: 'Possible stroke' },
  { pattern: /\bsevere bleeding\b|\buncontrolled bleeding\b|\bbleeding heavily\b|\bblood loss\b/, label: 'Severe bleeding' },
  { pattern: /\bsuicidal\b|\bkill myself\b|\bend my life\b|\bself[- ]harm\b|\boverdose\b/, label: 'Immediate mental-health risk' },
  { pattern: /\banaphylaxis\b|\bthroat (is )?(closing|swelling)\b|\bswollen tongue\b|\bsevere allergic reaction\b/, label: 'Severe allergic reaction' },
  { pattern: /\bunconscious\b|\bpassed out\b|\bfainted\b|\bseizure\b|\bconvulsion\b/, label: 'Loss of consciousness or seizure' },
  { pattern: /\bblue lips\b|\bturning blue\b|\bchoking\b/, label: 'Airway emergency' },
  { pattern: /\bsevere head injury\b|\bhead trauma\b|\bhit (my|the) head hard\b/, label: 'Head injury' },
];

const SPECIALTY_MAP: Record<string, { specialties: string[]; urgency: NavigatorUrgency }> = {
  'chest pain': { specialties: ['Cardiology'], urgency: 'HIGH' },
  palpitations: { specialties: ['Cardiology'], urgency: 'MEDIUM' },
  'heart racing': { specialties: ['Cardiology'], urgency: 'MEDIUM' },
  'blood pressure': { specialties: ['Cardiology', 'Internal Medicine'], urgency: 'MEDIUM' },
  hypertension: { specialties: ['Cardiology', 'Internal Medicine'], urgency: 'MEDIUM' },
  cough: { specialties: ['Pulmonology', 'Internal Medicine'], urgency: 'LOW' },
  wheeze: { specialties: ['Pulmonology'], urgency: 'MEDIUM' },
  asthma: { specialties: ['Pulmonology'], urgency: 'MEDIUM' },
  copd: { specialties: ['Pulmonology'], urgency: 'MEDIUM' },
  'shortness of breath': { specialties: ['Pulmonology', 'Cardiology'], urgency: 'HIGH' },
  diabetes: { specialties: ['Endocrinology'], urgency: 'MEDIUM' },
  'blood sugar': { specialties: ['Endocrinology'], urgency: 'MEDIUM' },
  thyroid: { specialties: ['Endocrinology'], urgency: 'LOW' },
  fatigue: { specialties: ['Internal Medicine', 'Endocrinology'], urgency: 'LOW' },
  headache: { specialties: ['Neurology', 'Internal Medicine'], urgency: 'MEDIUM' },
  migraine: { specialties: ['Neurology'], urgency: 'MEDIUM' },
  dizziness: { specialties: ['Neurology', 'Cardiology'], urgency: 'MEDIUM' },
  'stomach pain': { specialties: ['Gastroenterology', 'Internal Medicine'], urgency: 'MEDIUM' },
  'abdominal pain': { specialties: ['Gastroenterology', 'Internal Medicine'], urgency: 'MEDIUM' },
  reflux: { specialties: ['Gastroenterology'], urgency: 'LOW' },
  'joint pain': { specialties: ['Orthopedics', 'Rheumatology'], urgency: 'LOW' },
  'back pain': { specialties: ['Orthopedics', 'Internal Medicine'], urgency: 'LOW' },
  knee: { specialties: ['Orthopedics'], urgency: 'LOW' },
  rash: { specialties: ['Dermatology'], urgency: 'LOW' },
  acne: { specialties: ['Dermatology'], urgency: 'LOW' },
  anxiety: { specialties: ['Psychiatry', 'Psychology'], urgency: 'MEDIUM' },
  depression: { specialties: ['Psychiatry'], urgency: 'MEDIUM' },
  insomnia: { specialties: ['Psychiatry', 'Internal Medicine'], urgency: 'LOW' },
  pregnancy: { specialties: ['Obstetrics & Gynecology'], urgency: 'MEDIUM' },
  'eye pain': { specialties: ['Ophthalmology'], urgency: 'MEDIUM' },
  'blurred vision': { specialties: ['Ophthalmology', 'Neurology'], urgency: 'MEDIUM' },
  'ear pain': { specialties: ['ENT'], urgency: 'LOW' },
  'sore throat': { specialties: ['ENT', 'Internal Medicine'], urgency: 'LOW' },
  fever: { specialties: ['Internal Medicine'], urgency: 'MEDIUM' },
  infection: { specialties: ['Infectious Disease', 'Internal Medicine'], urgency: 'MEDIUM' },
  kidney: { specialties: ['Nephrology', 'Urology'], urgency: 'MEDIUM' },
  urinary: { specialties: ['Urology'], urgency: 'MEDIUM' },
  'weight loss': { specialties: ['Endocrinology', 'Internal Medicine'], urgency: 'MEDIUM' },
  'weight gain': { specialties: ['Endocrinology'], urgency: 'LOW' },
  allergy: { specialties: ['Allergy & Immunology'], urgency: 'LOW' },
  'follow-up': { specialties: ['Internal Medicine'], urgency: 'LOW' },
  'post-surgery': { specialties: ['Surgery Follow-up'], urgency: 'MEDIUM' },
  medication: { specialties: ['Internal Medicine'], urgency: 'LOW' },
  'second opinion': { specialties: ['Internal Medicine'], urgency: 'LOW' },
};

const SPECIALTY_ALIASES: Record<string, string[]> = {
  Cardiology: ['cardiolog', 'cardiac'],
  Pulmonology: ['pulmonolog', 'respirat'],
  Endocrinology: ['endocrinolog', 'diabet'],
  Neurology: ['neurolog'],
  Gastroenterology: ['gastroenterolog', 'gastro'],
  Orthopedics: ['orthoped', 'orthopaed', 'musculoskelet'],
  Rheumatology: ['rheumatolog'],
  Dermatology: ['dermatolog'],
  Psychiatry: ['psychiatr', 'psycholog', 'mental'],
  Psychology: ['psycholog', 'mental'],
  'Obstetrics & Gynecology': ['obstetric', 'gynecolog', 'gynaecolog', 'obgyn', 'ob/gyn'],
  Ophthalmology: ['ophthalmolog', 'eye'],
  ENT: ['ent', 'otolaryng', 'ear', 'nose', 'throat'],
  'Internal Medicine': ['internal', 'general practitioner', 'family medicine', 'general medicine', 'nurse practitioner'],
  'Infectious Disease': ['infectious', 'infection'],
  Nephrology: ['nephrolog', 'renal'],
  Urology: ['urolog'],
  Oncology: ['oncolog', 'cancer'],
  'Allergy & Immunology': ['allerg', 'immunolog'],
  'Emergency Medicine': ['emergency', 'urgent'],
  'Surgery Follow-up': ['surgeon', 'surgery', 'surgical'],
  Pediatrics: ['pediatric', 'paediatric'],
};

function providerMatchesSpecialty(providerSpecialty: string, specialty: string): boolean {
  const haystack = providerSpecialty.toLowerCase();
  const aliases = SPECIALTY_ALIASES[specialty] ?? [specialty.toLowerCase()];
  return aliases.some((alias) => haystack.includes(alias));
}

function normaliseSymptom(value: string): string {
  return sanitizeUserText(value, 200).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Deterministic red-flag screen. Exported so tests can verify that no model or
 * database dependency is involved in deciding an emergency.
 */
export function detectRedFlags(symptoms: string[], conditions: string[]): string[] {
  const corpus = [...symptoms, ...conditions].join(' ').toLowerCase();
  const flags = new Set<string>();
  for (const flag of RED_FLAGS) {
    if (flag.pattern.test(corpus)) flags.add(flag.label);
  }
  return [...flags];
}

function urgencyRank(urgency: NavigatorUrgency): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, EMERGENCY: 3 }[urgency];
}

function highestUrgency(values: NavigatorUrgency[]): NavigatorUrgency {
  return values.reduce<NavigatorUrgency>(
    (highest, value) => (urgencyRank(value) > urgencyRank(highest) ? value : highest),
    'LOW'
  );
}

function buildRecommendations(
  symptoms: string[],
  conditions: string[]
): { recommendations: SpecialistRecommendation[]; urgency: NavigatorUrgency; triageSource: NavigatorResult['triageSource'] } {
  const found = new Map<string, { reasons: string[]; urgency: NavigatorUrgency }>();

  const consider = (text: string, source: 'symptom' | 'condition') => {
    const lower = text.toLowerCase();
    for (const [keyword, entry] of Object.entries(SPECIALTY_MAP)) {
      if (!lower.includes(keyword)) continue;
      for (const specialty of entry.specialties) {
        const current = found.get(specialty);
        const reason = `${source === 'symptom' ? 'Symptom' : 'Recorded condition'}: ${text}`;
        if (current) {
          if (!current.reasons.includes(reason)) current.reasons.push(reason);
          current.urgency = highestUrgency([current.urgency, entry.urgency]);
        } else {
          found.set(specialty, { reasons: [reason], urgency: entry.urgency });
        }
      }
    }
  };

  symptoms.forEach((symptom) => consider(symptom, 'symptom'));
  conditions.forEach((condition) => consider(condition, 'condition'));

  const recommendations: SpecialistRecommendation[] = [...found.entries()]
    .sort((a, b) => urgencyRank(b[1].urgency) - urgencyRank(a[1].urgency))
    .slice(0, 3)
    .map(([specialty, entry]) => ({
      specialty,
      department: `${specialty} Department`,
      reason: entry.reasons.slice(0, 2).join('; '),
      urgency: entry.urgency,
      confidence: 0.72,
    }));

  if (recommendations.length === 0) {
    return {
      recommendations: [
        {
          specialty: 'Internal Medicine',
          department: 'General Medicine',
          reason: 'No specific pattern was recognised, so a general clinician can assess and direct you.',
          urgency: 'LOW',
          confidence: 0.5,
        },
      ],
      urgency: 'LOW',
      triageSource: 'general',
    };
  }

  return {
    recommendations,
    urgency: highestUrgency(recommendations.map((rec) => rec.urgency)),
    triageSource: 'symptom-map',
  };
}

async function loadFacilities(specialties: string[], emergency: boolean): Promise<NavigatorFacility[]> {
  const providers = await prisma.provider.findMany({
    include: { facility: true },
    take: 200,
  });

  const grouped = new Map<
    string,
    { facility: (typeof providers)[number]['facility']; specialties: Set<string>; clinicians: string[] }
  >();

  for (const provider of providers) {
    const matches =
      emergency
        ? providerMatchesSpecialty(provider.specialty, 'Emergency Medicine') ||
          provider.facility.facilityType.toLowerCase().includes('hospital')
        : specialties.some((specialty) => providerMatchesSpecialty(provider.specialty, specialty));
    if (!matches) continue;

    const existing = grouped.get(provider.facilityId);
    if (existing) {
      existing.specialties.add(provider.specialty);
      existing.clinicians.push(`Dr. ${provider.firstName} ${provider.lastName}`);
    } else {
      grouped.set(provider.facilityId, {
        facility: provider.facility,
        specialties: new Set([provider.specialty]),
        clinicians: [`Dr. ${provider.firstName} ${provider.lastName}`],
      });
    }
  }

  return [...grouped.values()]
    .sort((a, b) => b.specialties.size - a.specialties.size)
    .slice(0, 4)
    .map((entry) => ({
      id: entry.facility.id,
      name: entry.facility.name,
      type: entry.facility.facilityType,
      address: entry.facility.address,
      contactNumber: entry.facility.contactNumber,
      reason: emergency
        ? `Emergency or hospital setting with ${entry.clinicians.length} clinician(s) on record`
        : `Has ${entry.clinicians.length} clinician(s): ${entry.clinicians.slice(0, 2).join(', ')}`,
      specialties: [...entry.specialties].slice(0, 5),
    }));
}

function buildCarePathway(
  recommendations: SpecialistRecommendation[],
  emergency: boolean,
  redFlags: string[]
): string[] {
  if (emergency) {
    return [
      `Call ${EMERGENCY_NUMBER} or go to the nearest emergency department now.`,
      redFlags.length > 0
        ? `Tell the responder about: ${redFlags.join(', ')}.`
        : 'Do not drive yourself if you feel faint or short of breath.',
      'Bring a list of medicines, allergies and recent test results if someone can fetch them.',
      'Do not wait for an online reply before seeking urgent help.',
    ];
  }

  const primary = recommendations[0]?.specialty ?? 'Internal Medicine';
  return [
    `Book a consultation with ${primary}${recommendations.length > 1 ? `, or ${recommendations[1].specialty}` : ''}.`,
    'Bring your current medication list and any recent reports to the visit.',
    'Write down when symptoms started, what makes them better or worse, and any treatments already tried.',
    'Ask the clinician what findings would change the plan, and when to seek urgent care.',
  ];
}

function deterministicExplanation(
  symptoms: string[],
  recommendations: SpecialistRecommendation[],
  urgency: NavigatorUrgency
): string {
  const summary = symptoms.slice(0, 4).join(', ');
  const primary = recommendations[0];
  if (urgency === 'EMERGENCY') {
    return `Your description (${summary}) includes warning signs that need urgent, in-person assessment. Please contact emergency services or go to an emergency department now rather than waiting for a routine appointment.`;
  }
  return `You described ${summary || 'a concern that does not match a specific specialty'}. Based on that, ${primary.specialty} is the most relevant starting point because ${primary.reason.toLowerCase()}. This is wayfinding guidance only — the clinician will confirm what is going on and may refer you elsewhere.`;
}

const explanationSchema = z.object({
  explanation: z.string().min(20).max(1500),
});

/**
 * Deterministic red-flag triage first, then a rule-based specialty map.
 * A model may only rewrite the patient-facing explanation; it cannot change the
 * urgency or the recommended specialty.
 */
export async function navigateCare(
  patientId: string,
  symptomsInput: string[],
  conditionsInput: string[] = []
): Promise<NavigatorResult> {
  const symptoms = symptomsInput.map(normaliseSymptom).filter(Boolean).slice(0, 10);
  const conditions = conditionsInput.map((value) => sanitizeUserText(value, 160)).filter(Boolean).slice(0, 10);

  const redFlags = detectRedFlags(symptoms, conditions);
  const generatedAt = new Date().toISOString();

  if (redFlags.length > 0) {
    const recommendations: SpecialistRecommendation[] = [
      {
        specialty: 'Emergency Medicine',
        department: 'Emergency Department',
        reason: `Warning signs detected: ${redFlags.join(', ')}`,
        urgency: 'EMERGENCY',
        confidence: 1,
      },
    ];
    const facilities = await loadFacilities(['Emergency Medicine'], true).catch((error: unknown) => {
      logger.warn({ err: error }, 'emergency facility lookup failed');
      return [] as NavigatorFacility[];
    });
    const emergencyGuidance = `Call ${EMERGENCY_NUMBER} now or go to the nearest emergency department. This is based on warning signs (${redFlags.join(', ')}), not a diagnosis.`;

    return {
      urgency: 'EMERGENCY',
      redFlags,
      recommendations,
      suggestedFacilities: facilities,
      carePathway: buildCarePathway(recommendations, true, redFlags),
      aiExplanation: emergencyGuidance,
      disclaimer: NAVIGATOR_DISCLAIMER,
      mode: 'rule-based',
      triageSource: 'red-flag',
      generatedAt,
    };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      medications: {
        where: { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
        select: { name: true, indication: true },
        take: 40,
      },
      medicalRecords: {
        where: { deletedAt: null },
        orderBy: { recordDate: 'desc' },
        select: { recordType: true, description: true },
        take: 5,
      },
    },
  });

  if (!patient) {
    // The API never reveals whether a patient exists to an unauthorised caller;
    // the route checks access before calling this function.
    throw new Error('Patient not found');
  }

  // Recorded conditions are used only as context for the rule map, never as
  // new diagnoses invented by the agent.
  const recordConditions = patient.medicalRecords.map((record) => record.description).slice(0, 3);
  const { recommendations, urgency, triageSource } = buildRecommendations(symptoms, [
    ...conditions,
    ...recordConditions,
  ]);

  const suggestedFacilities = await loadFacilities(
    recommendations.map((rec) => rec.specialty),
    false
  ).catch((error: unknown) => {
    logger.warn({ err: error }, 'facility lookup failed');
    return [] as NavigatorFacility[];
  });

  let aiExplanation = deterministicExplanation(symptoms, recommendations, urgency);
  let mode: 'ai' | 'rule-based' = 'rule-based';

  try {
    const result = await aiJson(explanationSchema, {
      task: 'navigation',
      system: `You write patient-facing wayfinding explanations. Do not diagnose, prescribe, change urgency, or invent facts. Do not mention medicines that were not supplied. ${DATA_ONLY_INSTRUCTION} Respond with {"explanation": "..."} in plain language, 2-4 sentences.`,
      user: [
        asData('SYMPTOMS', symptoms.join(', ')),
        asData('CONDITIONS', conditions.join(', ') || 'none supplied'),
        `Deterministic recommendation: ${recommendations.map((rec) => rec.specialty).join(', ')}`,
        `Deterministic urgency: ${urgency}`,
        `Active medicines (context only, do not advise changes): ${
          patient.medications.map((med) => med.name).join(', ') || 'none recorded'
        }`,
      ].join('\n'),
      maxTokens: 500,
      cache: true,
    });
    aiExplanation = result.value.explanation.trim();
    mode = 'ai';
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) {
      logger.warn({ err: error }, 'navigator explanation failed');
    }
  }

  return {
    urgency,
    redFlags,
    recommendations,
    suggestedFacilities,
    carePathway: buildCarePathway(recommendations, false, redFlags),
    aiExplanation,
    disclaimer: NAVIGATOR_DISCLAIMER,
    mode,
    triageSource,
    generatedAt,
  };
}
