import { useRouter } from 'next/router';
import { useAuth } from './auth';

/**
 * Resolve which patient the current screen is about.
 *
 * Patients always act on themselves. Clinicians and administrators must choose
 * a patient explicitly (via ?patientId=...), so no screen silently assumes a
 * record. The API enforces the same rule server-side.
 */
export function usePatientScope(): { patientId: string | null; isStaff: boolean } {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return { patientId: null, isStaff: false };
  if (user.role === 'PATIENT') return { patientId: user.patientId, isStaff: false };

  const value = router.query.patientId;
  const patientId = Array.isArray(value) ? value[0] ?? null : value ?? null;
  return { patientId, isStaff: true };
}
