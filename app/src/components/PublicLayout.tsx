import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from './AppShell';
import { ClinicalDisclaimer } from './ui/Alert';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-rule">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/" aria-label="MediFlow home">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
            <Link href="/#how" className="hidden text-ink-soft hover:text-ink sm:inline">
              How it works
            </Link>
            <Link href="/#safety" className="hidden text-ink-soft hover:text-ink sm:inline">
              Safety
            </Link>
            <Link href="/privacy" className="hidden text-ink-soft hover:text-ink sm:inline">
              Privacy
            </Link>
            <Link href="/login" className="nav-link font-semibold text-ink">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-rule bg-surface">
        <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              A calmer way to keep your medical history in order, understand your care plan and find the
              right next step.
            </p>
          </div>
          <div>
            <p className="eyebrow">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/#how" className="hover:text-ink">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#agents" className="hover:text-ink">
                  The five agents
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-ink">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">Trust</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/privacy" className="hover:text-ink">
                  Privacy notice
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-ink">
                  Terms of use
                </Link>
              </li>
              <li>
                <Link href="/#safety" className="hover:text-ink">
                  Clinical safety
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-rule">
          <div className="shell py-5">
            <ClinicalDisclaimer />
            <p className="mt-4 font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
              © {new Date().getFullYear()} MediFlow · Built for the Product Space AI Agent Hackathon
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
