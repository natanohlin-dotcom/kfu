import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
  /** Lägre höjd för tabeller och kort */
  dense?: boolean;
};

/** Inbyggd <select> i fältstil (tillgänglig och fungerar med tangentbord och skärmläsare). */
export function Select({ label, hideLabel, options, dense = false, id, className = "", ...rest }: Props) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className={hideLabel ? "sr-only" : "text-sm text-ink"}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={`w-full appearance-none rounded-sm bg-fill pr-9 text-ink transition-colors hover:bg-fill-hover focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 ${
            dense ? "min-h-8 px-3 py-1 text-sm" : "min-h-11 px-3.5 py-2"
          }`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      </div>
    </div>
  );
}
