import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import { useAuth } from '../lib/auth';
import { errorMessage, isApiError } from '../lib/api';
import { homeForRole, safeNext } from '../lib/navigation';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  contactNumber: string;
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  dateOfBirth: '',
  gender: 'OTHER',
  contactNumber: '',
};

export default function RegisterPage() {
  const { register, user, status } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const next = safeNext(router.query.next);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      void router.replace(next ?? homeForRole(user.role));
    }
  }, [status, user, next, router]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!agreed) {
      setError('Please confirm that you understand this is not an emergency service.');
      return;
    }
    if (form.password.length < 8) {
      setFieldErrors({ password: 'Use at least 8 characters' });
      return;
    }

    setSubmitting(true);
    try {
      const created = await register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        contactNumber: form.contactNumber.trim() || undefined,
      });
      await router.replace(next ?? homeForRole(created.role));
    } catch (caught) {
      if (isApiError(caught) && Array.isArray(caught.details)) {
        const mapped: Record<string, string> = {};
        for (const detail of caught.details as Array<{ path?: string; message?: string }>) {
          if (detail.path && detail.message) mapped[detail.path] = detail.message;
        }
        setFieldErrors(mapped);
      }
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create an account"
      title="Start with your own record."
      description="Patient accounts are self-service. Clinician and administrator accounts are provisioned by an administrator — never by public registration."
      asideTitle="Built to be reviewed, not trusted blindly."
      asidePoints={[
        'You see every extracted field before it is saved.',
        'Low-confidence fields are marked, not silently accepted.',
        'You can delete a document from your record at any time.',
        'Access is checked on every request, server-side.',
      ]}
    >
      <Head>
        <title>Create an account · MediFlow</title>
      </Head>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <Alert tone="danger" title="Could not create the account">
            {error}
          </Alert>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            value={form.firstName}
            onChange={(event) => set('firstName', event.target.value)}
            error={fieldErrors.firstName}
          />
          <TextField
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            value={form.lastName}
            onChange={(event) => set('lastName', event.target.value)}
            error={fieldErrors.lastName}
          />
        </div>

        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={fieldErrors.email}
          placeholder="you@example.com"
        />

        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(event) => set('password', event.target.value)}
          error={fieldErrors.password}
          hint="At least 8 characters. A passphrase is easier to remember."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Date of birth"
            type="date"
            name="dateOfBirth"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth}
            onChange={(event) => set('dateOfBirth', event.target.value)}
            error={fieldErrors.dateOfBirth}
          />
          <SelectField
            label="Gender"
            name="gender"
            value={form.gender}
            onChange={(event) => set('gender', event.target.value as FormState['gender'])}
            error={fieldErrors.gender}
          >
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other / prefer not to say</option>
          </SelectField>
        </div>

        <TextField
          label="Contact number"
          type="tel"
          name="contactNumber"
          autoComplete="tel"
          optional
          value={form.contactNumber}
          onChange={(event) => set('contactNumber', event.target.value)}
          error={fieldErrors.contactNumber}
        />

        <label className="flex items-start gap-3 border-t border-rule pt-4 text-xs leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 border-rule-strong text-pine focus:ring-pine"
          />
          <span>
            I understand MediFlow is not an emergency service, does not diagnose, and that I should call my
            local emergency number if I am in immediate danger. I agree to the{' '}
            <Link href="/terms" className="btn-link text-xs">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="btn-link text-xs">
              privacy notice
            </Link>
            .
          </span>
        </label>

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Creating account' : 'Create patient account'}
        </Button>
      </form>

      <p className="mt-6 border-t border-rule pt-5 text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="btn-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
