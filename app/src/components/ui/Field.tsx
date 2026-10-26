import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/format';

interface Shared {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  id,
  ...rest
}: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div>
      <label className="field-label" htmlFor={inputId}>
        {label}
        {optional ? <span className="ml-1 normal-case tracking-normal text-ink-faint">(optional)</span> : null}
      </label>
      <input
        id={inputId}
        className={cn('field', error && 'field-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${inputId}-help` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-help`} className="mt-1.5 text-xs text-crimson">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-help`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  className,
  id,
  ...rest
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div>
      <label className="field-label" htmlFor={inputId}>
        {label}
        {optional ? <span className="ml-1 normal-case tracking-normal text-ink-faint">(optional)</span> : null}
      </label>
      <textarea
        id={inputId}
        className={cn('field min-h-[7rem] resize-y', error && 'field-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${inputId}-help` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-help`} className="mt-1.5 text-xs text-crimson">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-help`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  id,
  children,
  ...rest
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div>
      <label className="field-label" htmlFor={inputId}>
        {label}
        {optional ? <span className="ml-1 normal-case tracking-normal text-ink-faint">(optional)</span> : null}
      </label>
      <select
        id={inputId}
        className={cn('field', error && 'field-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${inputId}-help` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${inputId}-help`} className="mt-1.5 text-xs text-crimson">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-help`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
