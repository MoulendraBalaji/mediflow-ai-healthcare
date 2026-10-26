export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type RecordType =
  | 'PRESCRIPTION'
  | 'LAB_REPORT'
  | 'DISCHARGE_SUMMARY'
  | 'IMAGING'
  | 'ENCOUNTER'
  | 'OTHER';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NOSHOW';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type ReminderType = 'MEDICATION' | 'APPOINTMENT' | 'FOLLOW_UP' | 'REFILL';
export type ReminderStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'DISMISSED';
export type AgentName = 'INTAKE' | 'TIMELINE' | 'NAVIGATOR' | 'COMPANION' | 'INSIGHT';
export type AgentStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ApiMeta {
  total?: number;
  limit?: number;
  offset?: number;
  duration?: number;
  activityId?: string;
  disclaimer?: string;
  patientId?: string;
  cached?: boolean;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }> | unknown;
    requestId?: string;
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  email: string | null;
  contactNumber: string | null;
  address?: string | null;
  emergencyContact?: string | null;
}

export interface ProviderFacility {
  id: string;
  name: string;
  facilityType: string;
  address: string;
}

export interface ProviderProfile {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email: string | null;
  contactNumber: string | null;
  facility: ProviderFacility | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  patientId: string | null;
  providerId: string | null;
  patient: PatientProfile | null;
  provider: ProviderProfile | null;
}

// ---------------------------------------------------------------------------
// Clinical data
// ---------------------------------------------------------------------------

export interface Medication {
  id: string;
  patientId: string;
  recordId: string | null;
  name: string;
  dosage: string | null;
  frequency: string | null;
  indication: string | null;
  prescribedBy: string | null;
  startDate: string;
  endDate: string | null;
  refillDueDate: string | null;
  record?: {
    id: string;
    recordDate: string;
    recordType: RecordType;
    description: string;
  } | null;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  providerId: string | null;
  facilityId: string;
  recordType: RecordType;
  recordDate: string;
  description: string;
  fileName: string | null;
  filePath: string | null;
  extractedData: unknown;
  deletedAt: string | null;
  createdAt: string;
  provider: { id: string; firstName: string; lastName: string; specialty: string } | null;
  facility: { id: string; name: string; facilityType: string; address?: string } | null;
  medications: Medication[];
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  facilityId: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  urgency: Urgency;
  reason: string | null;
  cancelledAt: string | null;
  rescheduledFrom: string | null;
  provider: { id: string; firstName: string; lastName: string; specialty: string };
  facility: { id: string; name: string; facilityType?: string; address?: string };
}

export interface Reminder {
  id: string;
  patientId: string;
  reminderType: ReminderType;
  title: string;
  description: string | null;
  dueDate: string;
  status: ReminderStatus;
  createdAt: string;
}

export interface FacilitySummary {
  id: string;
  name: string;
  type: string;
  facilityType: string;
  address: string;
  contactNumber: string | null;
  email: string | null;
  providerCount: number;
  specialties: string[];
  providers: Array<{ id: string; firstName: string; lastName: string; specialty: string }>;
  counts?: { records: number; appointments: number };
}

export interface ProviderDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email: string | null;
  contactNumber: string | null;
  facility: ProviderFacility | null;
}

export interface DoctorPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageBand: string;
  gender: Gender;
  contactNumber: string | null;
  counts: { records: number; appointments: number; activeMedications: number };
  nextAppointment: {
    id: string;
    appointmentDate: string;
    appointmentTime: string;
    reason: string | null;
    urgency: Urgency;
  } | null;
  latestRecord: { recordDate: string; recordType: RecordType; description: string } | null;
}

export interface PatientSummary {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: Gender;
    ageBand: string;
    contactNumber: string | null;
    address: string | null;
    emergencyContact: string | null;
  };
  activeMedications: Medication[];
  allergies: string[];
  diagnoses: string[];
  recentRecords: MedicalRecord[];
  recentAppointments: Appointment[];
  summary: string;
  mode: 'ai' | 'rule-based';
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  completedConsultations: number;
  pendingAppointments: number;
  activeMedications: number;
  upcomingFollowUps: number;
  recordsUploaded: number;
  pendingReminders: number;
  nextAppointment: Appointment | null;
  latestRecord: {
    id: string;
    recordDate: string;
    recordType: RecordType;
    description: string;
  } | null;
  generatedAt: string;
}

export interface MedicationLists {
  active: Medication[];
  inactive: Medication[];
}

export interface ReminderStats {
  pending: number;
  sent: number;
  acknowledged: number;
  dismissed: number;
  overdue: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Intake
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

export interface ExtractionResult {
  status: 'ok' | 'needs_ocr';
  needsOcr: boolean;
  source: 'document' | 'demo';
  demo: boolean;
  extractor: 'pdf-text' | 'plain-text' | 'vision' | 'demo';
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

export interface SaveRecordPayload {
  patientId?: string;
  providerId?: string | null;
  facilityId?: string;
  recordType: RecordType;
  recordDate: string;
  description: string;
  fileName?: string | null;
  filePath?: string | null;
  extractedData?: unknown;
  medications: Array<{
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    indication?: string | null;
    prescribedBy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Agent outputs
// ---------------------------------------------------------------------------

export interface NavigatorRecommendation {
  specialty: string;
  department: string;
  reason: string;
  urgency: Urgency;
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
  urgency: Urgency;
  redFlags: string[];
  recommendations: NavigatorRecommendation[];
  suggestedFacilities: NavigatorFacility[];
  carePathway: string[];
  aiExplanation: string;
  disclaimer: string;
  mode: 'ai' | 'rule-based';
  triageSource: 'red-flag' | 'symptom-map' | 'general';
  generatedAt: string;
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
  gaps: Array<{
    type: 'BETWEEN_RECORDS' | 'ONGOING';
    startDate: string;
    endDate: string;
    days: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  duplicates: Array<{
    name: string;
    dates: string[];
    count: number;
    overlapping: boolean;
    note: string;
  }>;
  conflicts: Array<{
    drug1: string;
    drug2: string;
    reason: string;
    severity: 'warning' | 'critical';
  }>;
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

export interface GeneratedReminder {
  key: string;
  reminderType: ReminderType;
  title: string;
  description: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  existing: boolean;
}

export interface CompanionResult {
  reminders: GeneratedReminder[];
  explanations: Record<string, string>;
  missedAppointments: Array<{
    appointmentId: string;
    reason: string;
    date: string;
    providerName: string;
  }>;
  careEngagementScore: number;
  scoreBasis: string;
  aiSummary: string;
  mode: 'ai' | 'rule-based';
  generatedAt: string;
  created?: number;
}

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

export interface AgentActivity {
  id: string;
  agentName: AgentName;
  label: string;
  description: string;
  status: AgentStatus;
  duration: number | null;
  createdAt: string;
  input: unknown;
  output: unknown;
  meta: unknown;
  hasError: boolean;
  briefOutput: string;
}

export interface AiStatus {
  configured: boolean;
  available: boolean;
  mode: 'ai' | 'rule-based';
  model: string | null;
  reason?: string;
  generatedAt: string;
}

export interface AppointmentSlot {
  time: string;
  available: boolean;
  reason: string | null;
}

export interface TranslationResult {
  original: string;
  translated: string | null;
  language: string;
  available: boolean;
  mode: 'ai' | 'unavailable';
  cached?: boolean;
  message?: string;
}

export interface ExplanationResult {
  original: string;
  explanation: string;
  language: string;
  available: boolean;
  mode: 'ai' | 'rule-based';
  cached?: boolean;
  message?: string;
}
