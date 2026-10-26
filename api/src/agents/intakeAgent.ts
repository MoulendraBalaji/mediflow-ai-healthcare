/**
 * Backwards-compatible facade for the Intake agent.
 *
 * The real implementation lives in `services/intakeService.ts`, which reads
 * documents with an AI model and never fabricates clinical data. Older
 * imports are kept so routes/pages can migrate without breaking builds.
 */
export {
  extractDocument,
  normaliseRecordType,
  type ExtractionResult,
  type ExtractedMedicalData,
  type ExtractedMedication,
  type FieldConfidence,
} from '../services/intakeService.js';
