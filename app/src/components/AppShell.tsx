import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { cn, formatDate, initials, ROLE_LABELS } from '../lib/format';
import type { Role } from '../lib/types';
import { Button } from './ui/Button';

interface NavItem {
  href: string;
  label: string;
}

const NAV: Record<Role, NavItem[]> = {
  PATIENT: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/timeline', label: 'Timeline' },
    { href: '/upload', label: 'Documents' },
    { href: '/appointments', label: 'Appointments' },
    { href: '/navigator', label: 'Navigator' },
    { href: '/reminders', label: 'Reminders' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/translate', label: 'Explain' },
  ],
  DOCTOR: [
    { href: '/doctor-portal', label: 'Patient panel' },
    { href: '/navigator', label: 'Navigator' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/translate', label: 'Explain' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Analytics' },
    { href: '/facilities', label: 'Facilities' },
  ],
};

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">MediFlow</span>
      <span className="hidden font-mono text-2xs uppercase tracking-[0.18em] text-ink-faint sm:inline">
        Clinical record
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') {
      const next = encodeURIComponent(router.asPath || '/dashboard');
      void router.replace(`/login?next=${next}`);
    }
  }, [status, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [router.asPath]);

  if (status === 'loading') {
    return (
      <div className="shell py-20" role="status" aria-label="Checking your session">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-72" />
          <div className="skeleton h-4 w-64" />
        </div>
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <div className="shell py-20">
        <p className="text-sm text-ink-soft">Redirecting you to sign in…</p>
      </div>
    );
  }

  const items = NAV[user.role];
  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  const signOut = async () => {
    await logout();
    void router.replace('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <div className="border-b border-rule bg-ink text-paper">
        <div className="shell flex flex-wrap items-center justify-between gap-2 py-1.5">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/70">
            Recorded care · {formatDate(new Date())}
          </p>
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/70">
            Not for emergencies — call your local emergency number
          </p>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95">
        <div className="shell flex items-center justify-between gap-6 py-4">
          <Link href={user.role === 'PATIENT' ? '/dashboard' : user.role === 'ADMIN' ? '/admin' : '/doctor-portal'} aria-label="MediFlow home">
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('nav-link', isActive(item.href) && 'nav-link-active')}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-ink">{user.name}</p>
              <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center border border-rule-strong bg-surface font-mono text-xs text-ink-soft"
              aria-hidden="true"
            >
              {user.patient
                ? initials(user.patient.firstName, user.patient.lastName)
                : user.provider
                  ? initials(user.provider.firstName, user.provider.lastName)
                  : user.name.charAt(0).toUpperCase()}
            </div>
            <Button variant="quiet" onClick={signOut}>
              Sign out
            </Button>
          </div>

          <button
            type="button"
            className="btn-quiet lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen ? (
          <div id="mobile-nav" className="border-t border-rule bg-paper lg:hidden">
            <div className="shell py-4">
              <nav aria-label="Primary mobile" className="flex flex-col">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'border-b border-rule py-3 text-base',
                      isActive(item.href) ? 'font-semibold text-ink' : 'text-ink-soft'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{user.name}</p>
                  <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>
                <Button variant="secondary" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <div className="shell pb-20">{children}</div>
      </main>

      <footer className="border-t border-rule">
        <div className="shell flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
            MediFlow · recorded care, in order
          </p>
          <div className="flex gap-5 text-xs text-ink-soft">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/" className="hover:text-ink">
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
