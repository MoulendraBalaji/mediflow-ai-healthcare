import type { Role } from './types';

export function homeForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'DOCTOR') return '/doctor-portal';
  return '/dashboard';
}

/** Only allow same-site absolute paths to be used as a post-login destination. */
export function safeNext(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  return candidate;
}
