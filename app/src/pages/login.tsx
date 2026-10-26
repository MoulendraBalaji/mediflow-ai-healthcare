import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../lib/auth';
import { errorMessage, isApiError } from '../lib/api';
import { homeForRole } from '../lib/navigation';

export default function LoginPage() {
  const { login, user, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const nextParam = typeof router.query.next === 'string' ? router.query.next : null;

  useEffect(() => {
    if (status === 'authenticated' && user) {
      const target = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : homeForRole(user.role);
      void router.replace(target);
    }
  }, [status, user, nextParam, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      const target =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? nextParam
          : homeForRole(signedIn.role);
      await router.replace(target);
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
      eyebrow="Sign in"
      title="Pick up where you left off."
      description="Your documents, chronology and care plan are waiting. Sign in with the email you registered."
      asideTitle="A record that explains itself."
      asidePoints={[
        'Documents are read, then shown to you before anything is saved.',
        'The timeline checks gaps, duplicates and rule-based interactions.',
        'Every clinical output is labelled as AI-assisted or rule-based.',
        'If something cannot be read, MediFlow says so rather than guessing.',
      ]}
    >
      <Head>
        <title>Sign in · MediFlow</title>
      </Head>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <Alert tone="danger" title="Could not sign in">
            {error}
          </Alert>
        ) : null}

        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          placeholder="you@example.com"
        />

        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          placeholder="Your password"
        />

        <div className="flex items-center justify-between gap-4">
          <Link href="/forgot-password" className="btn-link text-sm">
            Forgot password?
          </Link>
          <p className="text-xs text-ink-faint">Cookies are httpOnly and same-site.</p>
        </div>

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 border-t border-rule pt-5 text-sm text-ink-soft">
        New to MediFlow?{' '}
        <Link href="/register" className="btn-link">
          Create a patient account
        </Link>
      </p>

      <div className="mt-6 border border-rule bg-surface p-4">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">Seeded demo accounts</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Patient <span className="font-mono">robert.anderson@mediflow.dev</span> · clinician{' '}
          <span className="font-mono">john.smith@mediflow.dev</span> · admin{' '}
          <span className="font-mono">admin@mediflow.dev</span>. The password comes from{' '}
          <span className="font-mono">DEMO_PASSWORD</span>; it is never printed by the app.
        </p>
      </div>
    </AuthLayout>
  );
}
