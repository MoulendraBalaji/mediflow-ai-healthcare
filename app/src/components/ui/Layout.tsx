import type { ReactNode } from 'react';
import { cn } from '../../lib/format';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('border-b border-rule pb-7 pt-8 sm:pb-9 sm:pt-10', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-sm mt-3">{title}</h1>
          {description ? <div className="lede mt-3 max-w-2xl text-base sm:text-lg">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">{meta}</div> : null}
    </header>
  );
}

export function SectionHeading({
  number,
  title,
  description,
  actions,
  id,
}: {
  number?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {number ? <p className="eyebrow">{number}</p> : null}
        <h2 id={id} className="mt-1 font-display text-2xl font-medium tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h2>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  value,
  label,
  note,
  accent = 'ink',
}: {
  value: ReactNode;
  label: string;
  note?: string;
  accent?: 'ink' | 'pine' | 'clay' | 'crimson' | 'ochre';
}) {
  const accentClass = {
    ink: 'text-ink',
    pine: 'text-pine',
    clay: 'text-clay',
    crimson: 'text-crimson',
    ochre: 'text-ochre',
  }[accent];
  return (
    <div className="border-t border-ink pt-3">
      <p className={cn('stat-value', accentClass)}>{value}</p>
      <p className="stat-label">{label}</p>
      {note ? <p className="mt-2 text-xs leading-relaxed text-ink-faint">{note}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border border-dashed border-rule-strong bg-paper px-6 py-12 text-center', className)}>
      <p className="font-display text-xl text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
