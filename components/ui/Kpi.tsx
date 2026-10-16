/** Nyckeltalsruta (DESIGN.md §5): etikett, stort värde i Lato med tabulära siffror, förklaring. */
export function Kpi({ label, value, hint, tone }: { label: string; value: string | null; hint?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-surface px-5 py-5 sm:px-6">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className={`tabular mt-3 truncate text-[1.3125rem] leading-none sm:text-[1.75rem] ${value === null ? "text-ink-subtle" : tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink"}`}>
        {value ?? "–"}
      </div>
      {hint && <div className="mt-2 truncate text-xs text-ink-subtle">{hint}</div>}
    </div>
  );
}

export const toneOf = (v: number | null | undefined): "up" | "down" | undefined => (v == null ? undefined : v >= 0 ? "up" : "down");
