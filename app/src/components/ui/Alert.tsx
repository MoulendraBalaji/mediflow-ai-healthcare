import type { ReactNode } from 'react';
import { cn } from '../../lib/format';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<Tone, { wrap: string; label: string }> = {
  info: { wrap: 'border-sky/50 bg-sky-light', label: 'text-sky' },
  success: { wrap: 'border-pine/40 bg-pine-light', label: 'text-pine-dark' },
  warning: { wrap: 'border-ochre/50 bg-ochre-light', label: 'text-ochre' },
  danger: { wrap: 'border-crimson/50 bg-crimson-light', label: 'text-crimson' },
  neutral: { wrap: 'border-rule-strong bg-paper', label: 'text-ink-soft' },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = TONE[tone];
  return (
    <div
      className={cn('border-l-2 border-y border-r px-4 py-3.5', styles.wrap, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title ? (
            <p className={cn('font-mono text-2xs uppercase tracking-[0.12em]', styles.label)}>{title}</p>
          ) : null}
          {children ? <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function ModeNote({ mode, className }: { mode: 'ai' | 'rule-based' | 'unavailable'; className?: string }) {
  if (mode === 'ai') {
    return (
      <p className={cn('font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint', className)}>
        AI-assisted wording · facts taken only from your records
      </p>
    );
  }
  if (mode === 'unavailable') {
    return (
      <p className={cn('font-mono text-2xs uppercase tracking-[0.1em] text-ochre', className)}>
        AI unavailable · nothing was generated or invented
      </p>
    );
  }
  return (
    <p className={cn('font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint', className)}>
      Rule-based output · no model used
    </p>
  );
}

export function ClinicalDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint', className)}>
      MediFlow helps you organise and understand recorded care. It is not a diagnosis, prescription or
      emergency service. If you think you are in immediate danger, call your local emergency number now.
    </p>
  );
}
