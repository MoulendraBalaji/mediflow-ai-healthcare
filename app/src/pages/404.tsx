import Head from 'next/head';
import Link from 'next/link';
import { PublicLayout } from '../components/PublicLayout';
import { useAuth } from '../lib/auth';

export default function NotFoundPage() {
  const { user } = useAuth();
  const workspace =
    user?.role === 'ADMIN' ? '/admin' : user?.role === 'DOCTOR' ? '/doctor-portal' : '/dashboard';

  return (
    <PublicLayout>
      <Head>
        <title>Page not found · MediFlow</title>
      </Head>

      <div className="shell grid gap-10 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <p className="eyebrow">404 · Not on file</p>
          <p className="mt-4 font-display text-display font-medium leading-none text-rule-strong">404</p>
        </div>
        <div className="lg:pt-12">
          <h1 className="display-sm">This page is not in the record.</h1>
          <p className="lede mt-4 max-w-xl text-base">
            The address may be mistyped, or the page may have moved. Nothing was deleted by opening it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link href={workspace} className="btn-primary">
                Open your workspace
              </Link>
            ) : (
              <Link href="/" className="btn-primary">
                Back to the overview
              </Link>
            )}
            <Link href="/" className="btn-quiet">
              Home
            </Link>
            {user ? null : (
              <Link href="/login" className="btn-quiet">
                Sign in
              </Link>
            )}
          </div>
          <p className="mt-10 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
            If a link from inside MediFlow led here, report the page address to the deployment operator.
            Do not include patient details in a bug report.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
