import Head from 'next/head';
import Link from 'next/link';
import type { NextPageContext } from 'next';
import { PublicLayout } from '../components/PublicLayout';

export default function ErrorPage({ statusCode }: { statusCode?: number }) {
  const code = statusCode ?? 500;
  const isServer = code >= 500;

  return (
    <PublicLayout>
      <Head>
        <title>{`Error ${code} · MediFlow`}</title>
      </Head>

      <div className="shell grid gap-10 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <p className="eyebrow">{`Error ${code}`}</p>
          <p className="mt-4 font-display text-display font-medium leading-none text-rule-strong">{code}</p>
        </div>
        <div className="lg:pt-12">
          <h1 className="display-sm">
            {isServer ? 'Something failed on our side.' : 'That request could not be completed.'}
          </h1>
          <p className="lede mt-4 max-w-xl text-base">
            {isServer
              ? 'The page did not render. This is an application error, not a reading of your record. Nothing clinical was changed.'
              : 'The page could not be loaded with the details supplied. Check the address and try again.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
            >
              Try again
            </button>
            <Link href="/" className="btn-quiet">
              Back to the overview
            </Link>
            <Link href="/dashboard" className="btn-quiet">
              Dashboard
            </Link>
          </div>
          <p className="mt-10 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
            If this keeps happening, give the deployment operator the page address and the time it
            occurred. Do not include patient details in a bug report.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as { statusCode?: number }).statusCode : 404;
  return { statusCode };
};
