import type { ReactNode } from 'react';
import { PublicLayout } from './PublicLayout';
import { ClinicalDisclaimer } from './ui/Alert';

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  asideTitle,
  asidePoints,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  asideTitle: string;
  asidePoints: string[];
}) {
  return (
    <PublicLayout>
      <div className="shell grid gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-16">
        <aside className="order-2 border border-rule bg-ink p-7 text-paper sm:p-9 lg:order-1">
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-paper/60">MediFlow</p>
          <h2 className="mt-4 font-display text-3xl font-medium leading-tight text-paper">{asideTitle}</h2>
          <ul className="mt-7 space-y-4 border-t border-paper/20 pt-6">
            {asidePoints.map((point, index) => (
              <li key={point} className="flex gap-4 text-sm leading-relaxed text-paper/75">
                <span className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-paper/20 pt-5 text-xs leading-relaxed text-paper/50">
            MediFlow is not an emergency service. If you are in immediate danger, call your local emergency
            number.
          </p>
        </aside>

        <section className="order-1 lg:order-2">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-sm mt-3">{title}</h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-soft">{description}</p>
          <div className="mt-8 max-w-md">{children}</div>
          <ClinicalDisclaimer className="mt-10 max-w-md" />
        </section>
      </div>
    </PublicLayout>
  );
}
