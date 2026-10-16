import { useId, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string; hideLabel?: boolean };

/** Flerradigt fält i samma stil som Field (DESIGN.md §5). */
export function TextArea({ label, hint, error, hideLabel, id, className = "", rows = 4, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className={hideLabel ? "sr-only" : "text-sm text-ink"}>
        {label}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          "rounded-sm px-3.5 py-2.5 text-ink placeholder:text-ink-subtle transition-colors " +
          "hover:bg-fill-hover focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent " +
          (error ? "bg-down-soft ring-1 ring-down" : "bg-fill")
        }
        {...rest}
      />
      {hint && <p id={`${inputId}-hint`} className="text-sm text-ink-muted">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="text-sm text-down">{error}</p>}
    </div>
  );
}
