import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export type Stat = { label: string; value: string | null; hint?: string; tone?: "up" | "down" };

/**
 * Nyckeltalsruta (DESIGN.md §5): etikett till vänster, värde högerställt i kolumn.
 * Saknas alla värden visas inte rutan alls (t.ex. lönsamhet för ett index).
 */
export function StatSection({ title, stats, footer, className = "" }: { title: string; stats: Stat[]; footer?: ReactNode; className?: string }) {
  if (stats.every((s) => s.value === null)) return null;
  return (
    <Card title={title} className={className}>
      <dl className="flex flex-col">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 first:pt-0 last:border-0 last:pb-0">
            <dt className="text-ink-muted" title={s.hint}>
              {s.label}
            </dt>
            <dd className={`tabular text-right ${s.value === null ? "text-ink-subtle" : s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : "text-ink"}`}>
              {s.value ?? "–"}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-4 text-xs text-ink-subtle">{footer}</div>}
    </Card>
  );
}
