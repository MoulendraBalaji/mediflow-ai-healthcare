import Head from 'next/head';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { api, errorMessage } from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await api.auth.forgotPassword(email.trim());
      setMessage(result.message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password."
      description="Enter the email address on your account. The response is deliberately generic so it cannot be used to discover who has an account."
      asideTitle="No pretend emails."
      asidePoints={[
        'This deployment does not send email.',
        'The screen states that plainly instead of claiming a message was sent.',
        'If an account exists, an administrator can trigger a reset out of band.',
        'Nothing about your clinical record is exposed by this form.',
      ]}
    >
      <Head>
        <title>Reset password · MediFlow</title>
      </Head>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <Alert tone="danger" title="Request failed">
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert tone="info" title="Request received">
            {message}
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
          placeholder="you@example.com"
        />

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Sending request' : 'Request a reset'}
        </Button>
      </form>

      <p className="mt-6 border-t border-rule pt-5 text-sm text-ink-soft">
        Remembered it?{' '}
        <Link href="/login" className="btn-link">
          Return to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
