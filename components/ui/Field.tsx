import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

/** Textfält med kopplad etikett, hjälptext och felmeddelande (mall §9, tillgänglighet). */
export function Field({ label, hint, error, id, className = "", ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={
          "min-h-11 rounded-sm px-3.5 py-2 text-ink placeholder:text-ink-subtle transition-colors " +
          "hover:bg-fill-hover focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent " +
          (error ? "bg-down-soft ring-1 ring-down" : "bg-fill")
        }
        {...rest}
      />
      {hint && (
        <div id={hintId} className="text-sm text-ink-muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-sm text-down">
          {error}
        </p>
      )}
    </div>
  );
}
