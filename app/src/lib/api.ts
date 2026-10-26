import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type {
  AgentActivity,
  AiStatus,
  ApiEnvelope,
  ApiErrorBody,
  Appointment,
  AppointmentSlot,
  AppointmentStatus,
  CompanionResult,
  DashboardMetrics,
  DoctorPatient,
  ExplanationResult,
  ExtractionResult,
  FacilitySummary,
  HospitalAnalytics,
  MedicalRecord,
  MedicationLists,
  NavigatorResult,
  PatientInsight,
  PatientSummary,
  ProviderDirectoryEntry,
  Reminder,
  ReminderStats,
  ReminderStatus,
  SaveRecordPayload,
  SessionUser,
  TimelineAnalysis,
  TimelineEvent,
  TranslationResult,
  Urgency,
} from './types';

const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_URL = rawBase.replace(/\/+$/, '');
const baseURL = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 30_000,
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function normaliseError(error: AxiosError<ApiErrorBody>): ApiError {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    return new ApiError(
      status,
      body.error.code || 'REQUEST_FAILED',
      body.error.message || 'The request failed.',
      body.error.details,
      body.error.requestId
    );
  }
  if (status === 0) {
    return new ApiError(
      0,
      'NETWORK_ERROR',
      'We could not reach the MediFlow API. Check your connection and that the server is running.'
    );
  }
  return new ApiError(status, 'REQUEST_FAILED', error.message || 'The request failed.');
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/refresh', '/auth/logout'];

function isAuthPath(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true, timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && config && !config._retried && !isAuthPath(config.url)) {
      config._retried = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiClient.request(config);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mediflow:session-expired'));
      }
    }

    return Promise.reject(normaliseError(error));
  }
);

async function request<T>(config: AxiosRequestConfig): Promise<ApiEnvelope<T>> {
  const response = await apiClient.request<ApiEnvelope<T>>(config);
  return response.data;
}

async function data<T>(config: AxiosRequestConfig): Promise<T> {
  return (await request<T>(config)).data;
}

function multipart(file: File, fields: Record<string, string>): FormData {
  const form = new FormData();
  form.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value);
  }
  return form;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      data<{ user: SessionUser }>({ url: '/auth/login', method: 'POST', data: { email, password } }),
    register: (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: 'MALE' | 'FEMALE' | 'OTHER';
      contactNumber?: string;
    }) =>
      data<{ user: SessionUser }>({ url: '/auth/register', method: 'POST', data: payload }),
    session: () => data<{ user: SessionUser }>({ url: '/auth/session', method: 'GET' }),
    logout: () => data<{ signedOut: boolean }>({ url: '/auth/logout', method: 'POST' }),
    forgotPassword: (email: string) =>
      data<{ accepted: boolean; message: string }>({
        url: '/auth/forgot-password',
        method: 'POST',
        data: { email },
      }),
  },

  records: {
    list: async (
      patientId: string,
      options: { limit?: number; offset?: number; type?: string } = {}
    ): Promise<{ records: MedicalRecord[]; total: number }> => {
      const envelope = await request<{ records: MedicalRecord[] }>({
        url: `/medical-records/patient/${encodeURIComponent(patientId)}`,
        method: 'GET',
        params: {
          limit: options.limit ?? 50,
          offset: options.offset ?? 0,
          ...(options.type ? { type: options.type } : {}),
        },
      });
      return { records: envelope.data.records, total: envelope.meta?.total ?? envelope.data.records.length };
    },
    get: (id: string) => data<{ record: MedicalRecord }>({ url: `/medical-records/${id}`, method: 'GET' }),
    medications: (patientId: string) =>
      data<MedicationLists>({
        url: `/medical-records/medications/${encodeURIComponent(patientId)}`,
        method: 'GET',
      }),
    dashboardMetrics: (patientId: string) =>
      data<DashboardMetrics>({
        url: `/medical-records/${encodeURIComponent(patientId)}/dashboard-metrics`,
        method: 'GET',
      }),
    timelinePreview: (patientId: string, limit = 12) =>
      data<{ records: MedicalRecord[]; duplicateFlags: string[] }>({
        url: `/medical-records/${encodeURIComponent(patientId)}/timeline-preview`,
        method: 'GET',
        params: { limit },
      }),
    extract: (file: File, fields: { patientId?: string; recordType?: string }) =>
      data<{ extraction: ExtractionResult }>({
        url: '/medical-records/extract',
        method: 'POST',
        data: multipart(file, fields),
      }),
    create: (payload: SaveRecordPayload) =>
      data<{ record: MedicalRecord }>({ url: '/medical-records', method: 'POST', data: payload }),
    remove: (id: string) =>
      data<{ deleted: boolean; id: string }>({ url: `/medical-records/${id}`, method: 'DELETE' }),
  },

  agents: {
    status: () => data<AiStatus & { generatedAt: string }>({ url: '/agents/status', method: 'GET' }),
    timeline: (patientId?: string) =>
      data<TimelineAnalysis>({ url: '/agents/timeline/analyze', method: 'POST', data: { patientId } }),
    navigator: (symptoms: string[], currentConditions: string[] = [], patientId?: string) =>
      data<NavigatorResult>({
        url: '/agents/navigator/recommend',
        method: 'POST',
        data: { patientId, symptoms, currentConditions },
      }),
    companion: (patientId?: string) =>
      data<CompanionResult>({ url: '/agents/companion/generate', method: 'POST', data: { patientId } }),
    insight: (patientId?: string) =>
      data<PatientInsight>({ url: '/agents/insight/generate', method: 'POST', data: { patientId } }),
    latestInsight: (patientId: string) =>
      data<{ insight: PatientInsight; activityId: string; generatedAt: string; duration: number | null }>({
        url: `/agents/insights/latest/${encodeURIComponent(patientId)}`,
        method: 'GET',
      }),
    analytics: () =>
      data<HospitalAnalytics>({ url: '/agents/insight/analytics', method: 'GET' }),
  },

  activity: {
    list: async (patientId: string, limit = 10, offset = 0) => {
      const envelope = await request<{ activities: AgentActivity[] }>({
        url: '/agent-activity',
        method: 'GET',
        params: { patientId, limit, offset },
      });
      return {
        activities: envelope.data.activities,
        total: envelope.meta?.total ?? envelope.data.activities.length,
      };
    },
    get: (id: string) =>
      data<{ activity: AgentActivity }>({ url: `/agent-activity/${id}`, method: 'GET' }),
  },

  appointments: {
    list: async (patientId: string, status?: AppointmentStatus) => {
      const envelope = await request<{ appointments: Appointment[] }>({
        url: `/appointments/patient/${encodeURIComponent(patientId)}`,
        method: 'GET',
        params: { status, limit: 100 },
      });
      return {
        appointments: envelope.data.appointments,
        total: envelope.meta?.total ?? envelope.data.appointments.length,
      };
    },
    get: (id: string) =>
      data<{ appointment: Appointment }>({ url: `/appointments/${id}`, method: 'GET' }),
    providers: (search?: string, specialty?: string) =>
      data<{ providers: ProviderDirectoryEntry[] }>({
        url: '/appointments/providers/available',
        method: 'GET',
        params: { search, specialty },
      }),
    slots: (providerId: string, date: string) =>
      data<{ providerId: string; date: string; slots: AppointmentSlot[] }>({
        url: '/appointments/slots',
        method: 'GET',
        params: { providerId, date },
      }),
    create: (payload: {
      patientId?: string;
      providerId: string;
      appointmentDate: string;
      appointmentTime: string;
      reason?: string;
      urgency?: Urgency;
    }) => data<{ appointment: Appointment }>({ url: '/appointments', method: 'POST', data: payload }),
    cancel: (id: string) =>
      data<{ appointment: Appointment; alreadyCancelled?: boolean }>({
        url: `/appointments/${id}/cancel`,
        method: 'PATCH',
      }),
    reschedule: (id: string, payload: { appointmentDate: string; appointmentTime: string; reason?: string }) =>
      data<{ appointment: Appointment }>({
        url: `/appointments/${id}/reschedule`,
        method: 'PATCH',
        data: payload,
      }),
  },

  reminders: {
    list: async (patientId: string, status?: ReminderStatus) => {
      const envelope = await request<{ reminders: Reminder[] }>({
        url: `/reminders/patient/${encodeURIComponent(patientId)}`,
        method: 'GET',
        params: { status },
      });
      return {
        reminders: envelope.data.reminders,
        total: envelope.meta?.total ?? envelope.data.reminders.length,
      };
    },
    stats: (patientId: string) =>
      data<ReminderStats>({ url: `/reminders/stats/${encodeURIComponent(patientId)}`, method: 'GET' }),
    create: (payload: {
      patientId?: string;
      reminderType: Reminder['reminderType'];
      title: string;
      description?: string;
      dueDate: string;
    }) => data<{ reminder: Reminder }>({ url: '/reminders', method: 'POST', data: payload }),
    generate: (patientId: string) =>
      data<CompanionResult>({
        url: `/reminders/generate/${encodeURIComponent(patientId)}`,
        method: 'POST',
      }),
    acknowledge: (id: string) =>
      data<{ reminder: Reminder }>({ url: `/reminders/${id}/acknowledge`, method: 'PATCH' }),
    remove: (id: string) =>
      data<{ deleted: boolean; id: string }>({ url: `/reminders/${id}`, method: 'DELETE' }),
  },

  facilities: {
    list: (params: { type?: string; search?: string } = {}) =>
      data<{ facilities: FacilitySummary[] }>({ url: '/facilities', method: 'GET', params }),
    nearby: (type?: string, limit = 10) =>
      data<{ facilities: FacilitySummary[] }>({
        url: '/facilities/nearby',
        method: 'GET',
        params: { type, limit },
      }),
    emergency: () =>
      data<{ facilities: FacilitySummary[] }>({ url: '/facilities/emergency/list', method: 'GET' }),
    get: (id: string) =>
      data<{ facility: FacilitySummary }>({ url: `/facilities/${id}`, method: 'GET' }),
  },

  providers: {
    list: (params: { specialty?: string; search?: string } = {}) =>
      data<{ providers: ProviderDirectoryEntry[] }>({ url: '/providers', method: 'GET', params }),
    myPatients: () => data<{ patients: DoctorPatient[] }>({ url: '/providers/me/patients', method: 'GET' }),
    summary: (patientId: string) =>
      data<PatientSummary>({
        url: `/providers/patient/${encodeURIComponent(patientId)}/summary`,
        method: 'GET',
      }),
    translate: (text: string, language: string, patientId?: string) =>
      data<TranslationResult>({
        url: '/providers/translate',
        method: 'POST',
        data: { text, language, patientId },
      }),
    explain: (text: string, language: string, patientId?: string) =>
      data<ExplanationResult>({
        url: '/providers/explain-prescription',
        method: 'POST',
        data: { text, language, patientId },
      }),
  },
};

// Used by the upload review screen to keep the agent-activity view accurate.
export type { TimelineEvent };

export default api;
