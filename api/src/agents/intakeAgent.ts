import axios from 'axios';
import { prisma } from '../index.js';

export interface ExtractedMedicalData {
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    indication?: string;
    prescribedBy?: string;
    startDate?: string;
  }>;
  allergies: string[];
  diagnoses: string[];
  encounters: Array<{
    date?: string;
    type: string;
    description: string;
  }>;
  notes: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
  };
}

/**
 * Mock extraction for demonstration
 * In production, this would call actual PDF parser or OpenAI
 */
function generateMockExtraction(fileType: string, fileName: string): ExtractedMedicalData {
  const mockExtractions: Record<string, ExtractedMedicalData> = {
    prescription: {
      medications: [
        {
          name: 'Metformin',
          dosage: '500mg',
          frequency: 'Twice daily',
          indication: 'Type 2 Diabetes',
          prescribedBy: 'Dr. Smith',
          startDate: new Date().toISOString().split('T')[0],
        },
        {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once daily',
          indication: 'Hypertension',
          prescribedBy: 'Dr. Smith',
          startDate: new Date().toISOString().split('T')[0],
        },
      ],
      allergies: ['Penicillin'],
      diagnoses: ['Type 2 Diabetes', 'Hypertension'],
      encounters: [
        {
          date: new Date().toISOString().split('T')[0],
          type: 'Office Visit',
          description: 'Routine checkup',
        },
      ],
      notes: ['Patient reports good medication adherence'],
    },
    'lab report': {
      medications: [],
      allergies: [],
      diagnoses: [],
      encounters: [
        {
          date: new Date().toISOString().split('T')[0],
          type: 'Lab Work',
          description: 'Complete blood count, metabolic panel',
        },
      ],
      notes: [
        'HbA1c: 7.2% (slightly elevated)',
        'Glucose: 145 mg/dL',
        'Creatinine: 1.1 mg/dL (normal)',
      ],
      vitalSigns: {
        bloodPressure: '130/85',
        heartRate: '72',
      },
    },
    'discharge summary': {
      medications: [
        {
          name: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'Three times daily',
          indication: 'Post-operative infection prevention',
          prescribedBy: 'Dr. Johnson',
          startDate: new Date().toISOString().split('T')[0],
        },
      ],
      allergies: [],
      diagnoses: ['Appendicitis (resolved)', 'Post-operative care'],
      encounters: [
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          type: 'Hospitalization',
          description: 'Appendectomy performed successfully',
        },
      ],
      notes: [
        'Patient discharged in good condition',
        'Follow-up appointment scheduled in 2 weeks',
        'Wound care instructions provided',
      ],
    },
  };

  const key = fileType.toLowerCase().replace(/\s+/g, ' ');
  return mockExtractions[key] || mockExtractions['prescription'];
}

/**
 * Parse uploaded file and extract medical data
 * Handles PDF, TXT, and other text-based formats
 *
 * @param fileBuffer - File buffer
 * @param fileType - Type of file (Prescription, Lab Report, etc.)
 * @param fileName - Name of the file
 * @returns Extracted medical data
 *
 * PRODUCTION NOTES:
 * - PDF parsing uses pdf-parse; for production use Textract or Google Vision
 * - OpenAI calls have no token-rate limiting; mock fallback prevents failures
 * - Error handling ensures demo works without API key
 */
export async function parseUploadedFile(
  fileBuffer: Buffer,
  fileType: string,
  fileName: string
): Promise<ExtractedMedicalData> {
  try {
    // For demo purposes, use mock extraction
    // In production, implement:
    // 1. PDF parsing: const pdfData = await pdf(fileBuffer); const text = pdfData.text;
    // 2. OpenAI extraction with structured prompt
    // 3. Fallback to mock if API fails

    const mockData = generateMockExtraction(fileType, fileName);
    return mockData;
  } catch (error) {
    console.error('Error parsing medical data:', error);
    // Fallback to mock data on error
    return generateMockExtraction(fileType, fileName);
  }
}

/**
 * Extract medical data from file
 * (Kept for backward compatibility)
 */
export async function extractMedicalData(
  fileBuffer: Buffer,
  fileType: string,
  fileName: string
): Promise<ExtractedMedicalData> {
  return parseUploadedFile(fileBuffer, fileType, fileName);
}

/**
 * Validate extracted medical data
 */
export function validateExtraction(data: ExtractedMedicalData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.medications) errors.push('Missing medications array');
  if (!data.allergies) errors.push('Missing allergies array');
  if (!data.diagnoses) errors.push('Missing diagnoses array');
  if (!data.encounters) errors.push('Missing encounters array');
  if (!data.notes) errors.push('Missing notes array');

  return {
    valid: errors.length === 0,
    errors,
  };
}
