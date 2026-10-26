import { RecordType } from '@prisma/client';
import { z } from 'zod';
import pdfParse from 'pdf-parse';
import { isDemo } from '../config/env.js';
import { badRequest, HttpError } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { aiJson, aiVision, AiUnavailableError, asData, DATA_ONLY_INSTRUCTION } from './groqService.js';
import { detectFileType, imageMime, sanitizeFileName } from '../utils/files.js';

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

export interface ExtractedMedication {
  name: string;
  dosage: string | null;
  frequency: string | null;
  indication: string | null;
  prescribedBy: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ExtractedMedicalData {
  medications: ExtractedMedication[];
  allergies: string[];
  diagnoses: string[];
  encounters: Array<{ date: string | null; type: string; description: string }>;
  notes: string[];
  vitalSigns: {
    bloodPressure: string | null;
    heartRate: string | null;
    temperature: string | null;
    respiratoryRate: string | null;
  } | null;
}

export interface FieldConfidence {
  medications: number;
  allergies: number;
  diagnoses: number;
  encounters: number;
  notes: number;
  overall: number;
}

export type ExtractionExtractor = 'pdf-text' | 'plain-text' | 'vision' | 'demo';

export interface ExtractionResult {
  status: 'ok' | 'needs_ocr';
  needsOcr: boolean;
  source: 'document' | 'demo';
  demo: boolean;
  extractor: ExtractionExtractor;
  fileName: string;
  mimeType: string;
  recordType: RecordType;
  recordDate: string;
  providerName: string | null;
  facilityName: string | null;
  patientName: string | null;
  data: ExtractedMedicalData | null;
  confidence: FieldConfidence;
  message: string | null;
  pages: number | null;
}

// ---------------------------------------------------------------------------
// AI schema — every field is optional in the source document, so the model is
// told to return empty arrays rather than infer anything.
// ---------------------------------------------------------------------------

const nullableText = z.union([z.string(), z.null()]).optional();

const aiSchema = z.object({
  patientName: nullableText,
  recordDate: nullableText,
  providerName: nullableText,
  facilityName: nullableText,
  medications: z
    .array(
      z.object({
        name: z.string().min(1),
        dosage: nullableText,
        frequency: nullableText,
        indication: nullableText,
        prescribedBy: nullableText,
        startDate: nullableText,
        endDate: nullableText,
      })
    )
    .default([]),
  allergies: z.array(z.string()).default([]),
  diagnoses: z.array(z.string()).default([]),
  encounters: z
    .array(
      z.object({
        date: nullableText,
        type: z.string().default('Encounter'),
        description: z.string().min(1),
      })
    )
    .default([]),
  notes: z.array(z.string()).default([]),
  vitalSigns: z
    .object({
      bloodPressure: nullableText,
      heartRate: nullableText,
      temperature: nullableText,
      respiratoryRate: nullableText,
    })
    .nullish(),
  confidence: z
    .object({
      medications: z.number().min(0).max(1).optional(),
      allergies: z.number().min(0).max(1).optional(),
      diagnoses: z.number().min(0).max(1).optional(),
      encounters: z.number().min(0).max(1).optional(),
      notes: z.number().min(0).max(1).optional(),
    })
    .default({}),
});

type AiExtraction = z.infer<typeof aiSchema>;

const EXTRACTION_SYSTEM = `You are a careful clinical document reader. Extract only facts that are explicitly written in the document.

Rules:
- Never invent a medication, dose, allergy, diagnosis, date or vital sign.
- If a field is not present, return an empty array or null. Do not guess.
- Copy medication names, doses and frequencies exactly as printed.
- Dates must be ISO (YYYY-MM-DD) only when the document clearly states a date. Otherwise null.
- Set confidence between 0 and 1 for each section, honestly reflecting how legible the source was.
- ${DATA_ONLY_INSTRUCTION}

Return a JSON object with this exact shape:
{
  "patientName": string|null,
  "recordDate": string|null,
  "providerName": string|null,
  "facilityName": string|null,
  "medications": [{"name": string, "dosage": string|null, "frequency": string|null, "indication": string|null, "prescribedBy": string|null, "startDate": string|null, "endDate": string|null}],
  "allergies": [string],
  "diagnoses": [string],
  "encounters": [{"date": string|null, "type": string, "description": string}],
  "notes": [string],
  "vitalSigns": {"bloodPressure": string|null, "heartRate": string|null, "temperature": string|null, "respiratoryRate": string|null}|null,
  "confidence": {"medications": number, "allergies": number, "diagnoses": number, "encounters": number, "notes": number}
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECORD_LABELS: Record<RecordType, string> = {
  PRESCRIPTION: 'Prescription',
  LAB_REPORT: 'Lab report',
  DISCHARGE_SUMMARY: 'Discharge summary',
  IMAGING: 'Imaging report',
  ENCOUNTER: 'Clinical encounter note',
  OTHER: 'Medical document',
};

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0, 300));
  }
  return out;
}

function isoOrNull(value: string | null | undefined): string | null {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function recordDateOrToday(value: string | null | undefined): string {
  return isoOrNull(value) ?? new Date().toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function normaliseConfidence(raw: AiExtraction['confidence'], data: ExtractedMedicalData): FieldConfidence {
  const pick = (key: keyof Omit<FieldConfidence, 'overall'>, size: number): number =>
    round(raw[key] ?? (size > 0 ? 0.7 : 0.55));
  const medications = pick('medications', data.medications.length);
  const allergies = pick('allergies', data.allergies.length);
  const diagnoses = pick('diagnoses', data.diagnoses.length);
  const encounters = pick('encounters', data.encounters.length);
  const notes = pick('notes', data.notes.length);
  return {
    medications,
    allergies,
    diagnoses,
    encounters,
    notes,
    overall: round((medications + allergies + diagnoses + encounters + notes) / 5),
  };
}

function normaliseAi(raw: AiExtraction): {
  data: ExtractedMedicalData;
  confidence: FieldConfidence;
  recordDate: string;
  providerName: string | null;
  facilityName: string | null;
  patientName: string | null;
} {
  const data: ExtractedMedicalData = {
    medications: raw.medications
      .map((med) => ({
        name: med.name.trim().slice(0, 200),
        dosage: clean(med.dosage),
        frequency: clean(med.frequency),
        indication: clean(med.indication),
        prescribedBy: clean(med.prescribedBy),
        startDate: isoOrNull(med.startDate),
        endDate: isoOrNull(med.endDate),
      }))
      .filter((med) => med.name.length > 0),
    allergies: uniqueStrings(raw.allergies),
    diagnoses: uniqueStrings(raw.diagnoses),
    encounters: raw.encounters
      .map((encounter) => ({
        date: isoOrNull(encounter.date),
        type: encounter.type.trim().slice(0, 100) || 'Encounter',
        description: encounter.description.trim().slice(0, 500),
      }))
      .filter((encounter) => encounter.description.length > 0),
    notes: uniqueStrings(raw.notes),
    vitalSigns: raw.vitalSigns
      ? {
          bloodPressure: clean(raw.vitalSigns.bloodPressure),
          heartRate: clean(raw.vitalSigns.heartRate),
          temperature: clean(raw.vitalSigns.temperature),
          respiratoryRate: clean(raw.vitalSigns.respiratoryRate),
        }
      : null,
  };

  return {
    data,
    confidence: normaliseConfidence(raw.confidence, data),
    recordDate: recordDateOrToday(raw.recordDate),
    providerName: clean(raw.providerName),
    facilityName: clean(raw.facilityName),
    patientName: clean(raw.patientName),
  };
}

/** Whitespace-insensitive length check used for the OCR requirement. */
function readableLength(text: string): number {
  return text.replace(/\s+/g, '').length;
}

function demoExtraction(): ExtractionResult {
  const today = new Date().toISOString().slice(0, 10);
  return {
    status: 'ok',
    needsOcr: false,
    source: 'demo',
    demo: true,
    extractor: 'demo',
    fileName: 'demo-prescription.pdf',
    mimeType: 'application/pdf',
    recordType: 'PRESCRIPTION',
    recordDate: today,
    providerName: 'Demo Clinician',
    facilityName: 'Demo Clinic',
    patientName: 'Demo Patient',
    data: {
      medications: [
        {
          name: 'Metformin',
          dosage: '500 mg',
          frequency: 'Twice daily with meals',
          indication: 'Type 2 diabetes',
          prescribedBy: 'Demo Clinician',
          startDate: today,
          endDate: null,
        },
      ],
      allergies: [],
      diagnoses: ['Type 2 diabetes'],
      encounters: [{ date: today, type: 'Prescription', description: 'Demo prescription generated in DEMO_MODE.' }],
      notes: ['DEMO DATA — not a real clinical document.'],
      vitalSigns: null,
    },
    confidence: { medications: 0, allergies: 0, diagnoses: 0, encounters: 0, notes: 0, overall: 0 },
    message: 'DEMO_MODE is on. This is sample data, not a reading of your document.',
    pages: null,
  };
}

async function readPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    const parsed = await pdfParse(buffer);
    return { text: parsed.text ?? '', pages: parsed.numpages ?? 0 };
  } catch (error) {
    logger.warn({ err: error }, 'pdf parsing failed');
    throw badRequest('We could not read this PDF. It may be password-protected or damaged.');
  }
}

function visionPrompt(recordType: RecordType): string {
  return `${EXTRACTION_SYSTEM}\n\nThe attached image is a ${RECORD_LABELS[recordType]}. Read it carefully.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract structured data from an uploaded document.
 *
 * Never returns fabricated clinical data: if the document is unreadable the
 * caller gets `needsOcr`, and if the AI layer fails the request fails loudly
 * with a 503 rather than guessing.
 */
export async function extractDocument(
  file: { buffer: Buffer; originalname?: string; mimetype?: string },
  requestedType: RecordType
): Promise<ExtractionResult> {
  const fileName = sanitizeFileName(file.originalname);
  const detected = detectFileType(file.buffer, file.mimetype);

  if (detected === 'unknown') {
    throw badRequest('That file is not a PDF, PNG, JPEG or plain text document.');
  }

  if (isDemo) return demoExtraction();

  const base = {
    source: 'document' as const,
    demo: false,
    fileName,
    mimeType: file.mimetype ?? 'application/octet-stream',
    recordType: requestedType,
  };

  if (detected === 'pdf') {
    const { text, pages } = await readPdf(file.buffer);
    const length = readableLength(text);

    if (length < 40) {
      return {
        ...base,
        status: 'needs_ocr',
        needsOcr: true,
        extractor: 'pdf-text',
        recordDate: new Date().toISOString().slice(0, 10),
        providerName: null,
        facilityName: null,
        patientName: null,
        data: null,
        confidence: { medications: 0, allergies: 0, diagnoses: 0, encounters: 0, notes: 0, overall: 0 },
        message:
          'This PDF has no readable text (it looks scanned or blank). We did not guess — upload a photo or a text-based PDF instead.',
        pages,
      };
    }

    const result = await aiJson(aiSchema, {
      task: 'intake',
      system: EXTRACTION_SYSTEM,
      user: [
        `Document type: ${RECORD_LABELS[requestedType]}`,
        asData('DOCUMENT_TEXT', text.slice(0, 18_000)),
      ].join('\n'),
      maxTokens: 3000,
    });

    const normalised = normaliseAi(result.value);
    return {
      ...base,
      status: 'ok',
      needsOcr: false,
      extractor: 'pdf-text',
      ...normalised,
      message: null,
      pages,
    };
  }

  if (detected === 'text') {
    const text = file.buffer.toString('utf8');
    if (readableLength(text) < 40) {
      return {
        ...base,
        status: 'needs_ocr',
        needsOcr: true,
        extractor: 'plain-text',
        recordDate: new Date().toISOString().slice(0, 10),
        providerName: null,
        facilityName: null,
        patientName: null,
        data: null,
        confidence: { medications: 0, allergies: 0, diagnoses: 0, encounters: 0, notes: 0, overall: 0 },
        message: 'This document contains almost no readable text, so we did not guess.',
        pages: null,
      };
    }

    const result = await aiJson(aiSchema, {
      task: 'intake',
      system: EXTRACTION_SYSTEM,
      user: [
        `Document type: ${RECORD_LABELS[requestedType]}`,
        asData('DOCUMENT_TEXT', text.slice(0, 18_000)),
      ].join('\n'),
      maxTokens: 3000,
    });

    return {
      ...base,
      status: 'ok',
      needsOcr: false,
      extractor: 'plain-text',
      ...normaliseAi(result.value),
      message: null,
      pages: null,
    };
  }

  // Images are read with vision. No OCR-length heuristic applies.
  const prompt = visionPrompt(requestedType);
  const vision = await aiVision({
    prompt,
    imageBase64: file.buffer.toString('base64'),
    mimeType: imageMime(detected),
    json: true,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(vision.content);
  } catch {
    throw new HttpError(503, 'EXTRACTION_FAILED', 'We could not read this image clearly. Please try a sharper photo.');
  }

  const validated = aiSchema.safeParse(parsed);
  if (!validated.success) {
    throw new HttpError(503, 'EXTRACTION_FAILED', 'The image reader returned an unexpected result. Please try again.');
  }

  return {
    ...base,
    status: 'ok',
    needsOcr: false,
    extractor: 'vision',
    ...normaliseAi(validated.data),
    message: null,
    pages: null,
  };
}

/** Map legacy record-type labels from older clients onto the enum. */
export function normaliseRecordType(value: unknown): RecordType {
  if (typeof value !== 'string') return 'OTHER';
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const direct = RecordType[key as keyof typeof RecordType];
  if (direct) return direct;
  const legacy: Record<string, RecordType> = {
    PRESCRIPTION: 'PRESCRIPTION',
    LAB: 'LAB_REPORT',
    LAB_REPORT: 'LAB_REPORT',
    DISCHARGE: 'DISCHARGE_SUMMARY',
    DISCHARGE_SUMMARY: 'DISCHARGE_SUMMARY',
    IMAGING: 'IMAGING',
    NOTE: 'ENCOUNTER',
    ENCOUNTER: 'ENCOUNTER',
    OTHER: 'OTHER',
  };
  return legacy[key] ?? 'OTHER';
}

export function extractionErrorStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (error instanceof AiUnavailableError) return 503;
  return 500;
}

export function extractionErrorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof AiUnavailableError) {
    if (error.code === 'not_configured') {
      return 'Document reading is not configured on this server (no AI key). Your file was not saved.';
    }
    return 'The document reader is unavailable right now. Your file was not saved — please try again shortly.';
  }
  return 'We could not read this document. Your file was not saved.';
}
