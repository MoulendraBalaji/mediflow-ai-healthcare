import type {
  AppointmentStatus,
  RecordType,
  ReminderType,
  Role,
  Urgency,
} from './types';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', DATE_OPTS).format(date);
}

export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const [hours, minutes] = value.split(':');
  if (hours === undefined || minutes === undefined) return value;
  const hour = Number(hours);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minutes}${suffix}`;
}

export function formatAppointment(value: string | null | undefined, time?: string | null): string {
  const day = formatDate(value);
  return time ? `${day} at ${formatTime(time)}` : day;
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const delta = date.getTime() - Date.now();
  const abs = Math.abs(delta);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return formatter.format(Math.round(delta / ms), unit);
  }
  return 'just now';
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ageFrom(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  PRESCRIPTION: 'Prescription',
  LAB_REPORT: 'Lab report',
  DISCHARGE_SUMMARY: 'Discharge summary',
  IMAGING: 'Imaging report',
  ENCOUNTER: 'Encounter note',
  OTHER: 'Other document',
};

export function recordTypeLabel(type: string): string {
  return RECORD_TYPE_LABELS[type as RecordType] ?? titleCase(type);
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  LOW: 'Routine',
  MEDIUM: 'Soon',
  HIGH: 'Urgent',
  EMERGENCY: 'Emergency',
};

export function urgencyClass(urgency: Urgency | 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'): string {
  switch (urgency) {
    case 'EMERGENCY':
      return 'tag-crimson';
    case 'HIGH':
      return 'tag-clay';
    case 'MEDIUM':
      return 'tag-ochre';
    default:
      return 'tag-pine';
  }
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NOSHOW: 'No show',
};

export function appointmentStatusClass(status: AppointmentStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'tag-pine';
    case 'CANCELLED':
      return 'tag-neutral';
    case 'NOSHOW':
      return 'tag-crimson';
    default:
      return 'tag-sky';
  }
}

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  MEDICATION: 'Medicine',
  APPOINTMENT: 'Appointment',
  FOLLOW_UP: 'Follow-up',
  REFILL: 'Refill',
};

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Clinician',
  ADMIN: 'Administrator',
};

export function riskClass(risk: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  if (risk === 'HIGH') return 'tag-crimson';
  if (risk === 'MEDIUM') return 'tag-ochre';
  return 'tag-pine';
}

export function scoreTone(score: number): 'pine' | 'ochre' | 'crimson' {
  if (score >= 75) return 'pine';
  if (score >= 50) return 'ochre';
  return 'crimson';
}

export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
