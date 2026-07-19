import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let token: string | null = null;

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (data: any) => apiClient.post('/auth/register', data),
  getSession: () => apiClient.get('/auth/session'),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),

  getPatientRecords: (patientId: string, limit = 50, offset = 0) =>
    apiClient.get(`/medical-records/patient/${patientId}?limit=${limit}&offset=${offset}`),
  getMedications: (patientId: string) =>
    apiClient.get(`/medical-records/medications/${patientId}`),
  getDashboardMetrics: (patientId: string) =>
    apiClient.get(`/medical-records/${patientId}/dashboard-metrics`),
  getTimelinePreview: (patientId: string, limit = 20) =>
    apiClient.get(`/medical-records/${patientId}/timeline-preview?limit=${limit}`),
  uploadMedicalRecord: (formData: FormData) =>
    apiClient.post('/medical-records/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createRecord: (data: any) => apiClient.post('/medical-records', data),

  parseIntake: (data: any) => apiClient.post('/agents/intake/parse', data),
  analyzeTimeline: (patientId: string) =>
    apiClient.post('/agents/timeline/analyze', { patientId }),

  navigateCare: (patientId: string, symptoms: string[], currentConditions: string[] = []) =>
    apiClient.post('/agents/navigator/recommend', { patientId, symptoms, currentConditions }),

  generateCompanion: (patientId: string) =>
    apiClient.post('/agents/companion/generate', { patientId }),

  generateInsight: (patientId: string) =>
    apiClient.post('/agents/insight/generate', { patientId }),

  getHospitalAnalytics: () =>
    apiClient.get('/agents/insight/analytics'),

  getAgentActivity: (patientId: string, limit = 10, offset = 0) =>
    apiClient.get(`/agent-activity?patientId=${patientId}&limit=${limit}&offset=${offset}`),
  getActivityDetail: (id: string) => apiClient.get(`/agent-activity/${id}`),

  getAppointments: (patientId: string, status?: string, limit = 50, offset = 0) =>
    apiClient.get(`/appointments/patient/${patientId}?status=${status || ''}&limit=${limit}&offset=${offset}`),
  createAppointment: (data: any) => apiClient.post('/appointments', data),
  getAvailableProviders: () => apiClient.get('/appointments/providers/available'),

  getReminders: (patientId: string, status?: string) =>
    apiClient.get(`/reminders/patient/${patientId}${status ? `?status=${status}` : ''}`),
  createReminder: (data: any) => apiClient.post('/reminders', data),
  acknowledgeReminder: (id: string) => apiClient.patch(`/reminders/${id}/acknowledge`),
  deleteReminder: (id: string) => apiClient.delete(`/reminders/${id}`),
  generateReminders: (patientId: string) =>
    apiClient.post(`/reminders/generate/${patientId}`),
  getReminderStats: (patientId: string) =>
    apiClient.get(`/reminders/stats/${patientId}`),

  getFacilities: (type?: string, search?: string) =>
    apiClient.get('/facilities', { params: { type, search } }),
  getNearbyFacilities: (type?: string, limit = 10) =>
    apiClient.get('/facilities/nearby', { params: { type, limit } }),
  getEmergencyFacilities: () =>
    apiClient.get('/facilities/emergency/list'),
  getFacilityDetail: (id: string) =>
    apiClient.get(`/facilities/${id}`),

  getProviderPatientSummary: (patientId: string) =>
    apiClient.get(`/providers/patient/${patientId}/summary`),
  getProviders: (specialty?: string) =>
    apiClient.get('/providers', { params: { specialty } }),

  translateText: (text: string, language: string) =>
    apiClient.post('/providers/translate', { text, language }),
  explainPrescription: (text: string, language: string) =>
    apiClient.post('/providers/explain-prescription', { text, language }),
};

export function setToken(newToken: string) {
  token = newToken;
  if (typeof window !== 'undefined') localStorage.setItem('token', newToken);
}

export function getToken() {
  if (typeof window !== 'undefined' && !token) token = localStorage.getItem('token');
  return token;
}

export function clearToken() {
  token = null;
  if (typeof window !== 'undefined') localStorage.removeItem('token');
}

export default apiClient;
