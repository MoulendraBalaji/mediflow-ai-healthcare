import { prisma } from '../index.js';
import { groqChat, groqJsonChat } from '../services/groqService.js';

export interface SpecialistRecommendation {
  specialty: string;
  department: string;
  reason: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency';
  confidence: number;
}

export interface NavigatorResult {
  recommendations: SpecialistRecommendation[];
  suggestedFacilities: Array<{
    name: string;
    type: string;
    address: string;
    reason: string;
  }>;
  carePathway: string;
  aiExplanation: string;
}

const SPECIALTY_MAP: Record<string, string[]> = {
  'chest pain': ['Cardiology', 'Emergency Medicine'],
  'shortness of breath': ['Pulmonology', 'Cardiology'],
  'diabetes': ['Endocrinology'],
  'blood pressure': ['Cardiology', 'Internal Medicine'],
  'headache': ['Neurology', 'Internal Medicine'],
  'stomach pain': ['Gastroenterology', 'Internal Medicine'],
  'skin rash': ['Dermatology'],
  'joint pain': ['Orthopedics', 'Rheumatology'],
  'eye problems': ['Ophthalmology'],
  'ear pain': ['ENT', 'Otolaryngology'],
  'anxiety': ['Psychiatry', 'Psychology'],
  'depression': ['Psychiatry'],
  'thyroid': ['Endocrinology'],
  'pregnancy': ['Obstetrics', 'Gynecology'],
  'child illness': ['Pediatrics'],
  'cancer': ['Oncology'],
  'kidney': ['Nephrology', 'Urology'],
  'liver': ['Hepatology', 'Gastroenterology'],
  'bones': ['Orthopedics'],
  'allergies': ['Allergy & Immunology', 'ENT'],
  'infection': ['Infectious Disease', 'Internal Medicine'],
  'post-surgery': ['Surgery Follow-up', 'Internal Medicine'],
  'respiratory': ['Pulmonology'],
  'cough': ['Pulmonology', 'Internal Medicine'],
  'fever': ['Internal Medicine', 'Infectious Disease'],
  'weight loss': ['Endocrinology', 'Internal Medicine'],
  'fatigue': ['Internal Medicine', 'Endocrinology'],
};

export async function navigateCare(
  patientId: string,
  symptoms: string[],
  currentConditions: string[] = []
): Promise<NavigatorResult> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      medications: { where: { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] } },
      medicalRecords: { orderBy: { recordDate: 'desc' }, take: 10 },
    },
  });

  if (!patient) throw new Error('Patient not found');

  const facilities = await prisma.facility.findMany();
  const providers = await prisma.provider.findMany({ include: { facility: true } });

  const medList = patient.medications.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ');
  const recentRecords = patient.medicalRecords.map(r => `${r.recordType}: ${r.description}`).join('\n');

  const systemPrompt = `You are a healthcare navigation assistant. Based on patient symptoms, medical history, and current medications, recommend the most appropriate specialists and care pathways. You must respond ONLY with valid JSON.

Available specialties: Cardiology, Endocrinology, Neurology, Gastroenterology, Dermatology, Orthopedics, Ophthalmology, ENT, Psychiatry, Pediatrics, Oncology, Nephrology, Urology, Pulmonology, Rheumatology, Internal Medicine, Emergency Medicine, Obstetrics/Gynecology, Allergy & Immunology, Infectious Disease.

Response format (JSON only):
{
  "recommendations": [
    {
      "specialty": "string",
      "department": "string",
      "reason": "string explaining why this specialist",
      "urgency": "Low|Medium|High|Emergency",
      "confidence": number between 0-1
    }
  ],
  "carePathway": "A step-by-step care pathway description",
  "aiExplanation": "A friendly patient-facing explanation of the recommended care path"
}`;

  const userPrompt = `Patient: ${patient.firstName} ${patient.lastName}, ${patient.gender}, DOB: ${patient.dateOfBirth}
Current Symptoms: ${symptoms.join(', ')}
Current Conditions: ${currentConditions.length > 0 ? currentConditions.join(', ') : 'None recorded'}
Current Medications: ${medList || 'None'}
Recent Medical Records:\n${recentRecords || 'None'}
Available Facilities: ${facilities.map(f => `${f.name} (${f.facilityType}) - ${f.address}`).join('\n')}
Available Providers: ${providers.map(p => `Dr. ${p.firstName} ${p.lastName} - ${p.specialty} at ${p.facility?.name}`).join('\n')}`;

  try {
    const result = await groqJsonChat<NavigatorResult>(systemPrompt, userPrompt);
    return result;
  } catch {
    return fallbackNavigation(symptoms, currentConditions, facilities, providers);
  }
}

function fallbackNavigation(
  symptoms: string[],
  conditions: string[],
  facilities: any[],
  providers: any[]
): NavigatorResult {
  const recommendations: SpecialistRecommendation[] = [];

  for (const symptom of symptoms) {
    const lower = symptom.toLowerCase();
    for (const [keyword, specialties] of Object.entries(SPECIALTY_MAP)) {
      if (lower.includes(keyword)) {
        for (const spec of specialties.slice(0, 2)) {
          if (!recommendations.find(r => r.specialty === spec)) {
            const provider = providers.find((p: any) => p.specialty.toLowerCase().includes(spec.toLowerCase()));
            recommendations.push({
              specialty: spec,
              department: provider?.facility?.name || spec + ' Department',
              reason: `Based on symptom: ${symptom}`,
              urgency: 'Medium',
              confidence: 0.7,
            });
          }
        }
        break;
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      specialty: 'Internal Medicine',
      department: 'General Medicine',
      reason: 'General consultation recommended for symptom evaluation',
      urgency: 'Low',
      confidence: 0.5,
    });
  }

  return {
    recommendations,
    suggestedFacilities: facilities.slice(0, 3).map((f: any) => ({
      name: f.name,
      type: f.facilityType,
      address: f.address,
      reason: 'Nearby facility',
    })),
    carePathway: '1. Visit recommended specialist\n2. Complete diagnostic tests\n3. Follow-up with specialist for results\n4. Begin treatment plan',
    aiExplanation: `Based on your symptoms, we recommend consulting a ${recommendations[0].specialty} specialist. ${recommendations[0].reason}.`,
  };
}
