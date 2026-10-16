"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, LineChart as LineIcon } from "lucide-react";
import type { ChartSeries } from "@/lib/portfolio/overview";

/**
 * Portföljen mot jämförelseindex (DESIGN.md §2, dataviz-riktlinjerna):
 * en y-axel i procent från periodens start, tunna linjer, hårkors med tooltip för alla serier,
 * förklaring med periodens utveckling som direktetikett och en tabellvy.
 */

const PERIODS = [
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 91 },
  { id: "ytd", label: "I år", days: null },
  { id: "1y", label: "1 år", days: 365 },
  { id: "3y", label: "3 år", days: 1096 },
  { id: "max", label: "Max", days: Infinity },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const color = (token: string) => `var(--color-${token})`;
const pct = (v: number, digits = 1) =>
  new Intl.NumberFormat("sv-SE", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "exceptZero" }).format(v);
const dateFmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("sv-SE", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

function periodStart(id: PeriodId, last: string): string {
  const p = PERIODS.find((x) => x.id === id)!;
  if (p.days === null) return `${Number(last.slice(0, 4)) - 1}-12-31`;
  if (p.days === Infinity) return "0000-00-00";
  return new Date(Date.parse(`${last}T00:00:00Z`) - p.days * 86_400_000).toISOString().slice(0, 10);
}

type Row = { date: string } & Record<string, number | string | null>;

export function PerformanceChart({ series, emptyNote }: { series: ChartSeries[]; emptyNote?: string }) {
  const base = series.find((s) => s.points.length > 1) ?? null;
  const hasPortfolio = series.some((s) => s.id === "portfolio" && s.points.length > 1);
  const [period, setPeriod] = useState<PeriodId>("ytd");
  const [view, setView] = useState<"chart" | "table">("chart");

  const { rows, changes } = useMemo(() => {
    if (!base) return { rows: [] as Row[], changes: new Map<string, number>() };
    const last = base.points.at(-1)!.date;
    const start = periodStart(period, last);
    // Datumaxeln: portföljens dagar om den finns, annars första indexets
    const dates = base.points.filter((p) => p.date >= start).map((p) => p.date);
    const rows: Row[] = dates.map((date) => ({ date }));
    const changes = new Map<string, number>();
    for (const s of series) {
      let i = -1;
      let baseValue: number | null = null;
      // Startvärde: sista punkten på eller före periodens första dag
      const before = s.points.filter((p) => p.date <= (dates[0] ?? start)).at(-1);
      baseValue = before?.value ?? null;
      for (const row of rows) {
        while (i + 1 < s.points.length && s.points[i + 1].date <= row.date) i++;
        const v = i >= 0 ? s.points[i].value : null;
        if (baseValue === null && v !== null) baseValue = v;
        row[s.id] = v !== null && baseValue ? v / baseValue - 1 : null;
      }
      const lastValue = rows.at(-1)?.[s.id];
      if (typeof lastValue === "number") changes.set(s.id, lastValue);
    }
    return { rows, changes };
  }, [series, base, period]);

  if (!base) {
    return <p className="py-16 text-center text-sm text-ink-muted">{emptyNote ?? "Ingen kursdata ännu."}</p>;
  }

  const spanDays = rows.length > 1 ? (Date.parse(rows.at(-1)!.date) - Date.parse(rows[0].date)) / 86_400_000 : 0;
  const tickFmt = (iso: string) => dateFmt(iso, spanDays > 400 ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Serier">
          {series.map((s) => {
            const change = changes.get(s.id);
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-ink">
                <span className="h-0.5 w-4 rounded-full" style={{ background: color(s.color) }} aria-hidden />
                {s.label}
                {change !== undefined && <span className={`tabular ${change >= 0 ? "text-up" : "text-down"}`}>{pct(change)}</span>}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2">
          <div className="flex rounded-sm bg-fill p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={p.id === period}
                className={`rounded-[7px] px-2.5 py-1 text-[0.8125rem] transition-colors ${p.id === period ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setView(view === "chart" ? "table" : "chart")}
            className="rounded-sm p-2 text-ink-muted hover:bg-fill hover:text-ink"
            aria-label={view === "chart" ? "Visa som tabell" : "Visa som graf"}
            title={view === "chart" ? "Visa som tabell" : "Visa som graf"}
          >
            {view === "chart" ? <Table2 className="size-4" /> : <LineIcon className="size-4" />}
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="h-64 sm:h-80" role="img" aria-label={`Utveckling ${PERIODS.find((p) => p.id === period)!.label}: ${series.map((s) => `${s.label} ${changes.has(s.id) ? pct(changes.get(s.id)!) : "–"}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="date"
                tickFormatter={tickFmt}
                tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => pct(v, 0)}
                tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={52}
                domain={["auto", "auto"]}
              />
              <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} label={props.label} series={series} />} cursor={{ stroke: "var(--color-ink-subtle)", strokeWidth: 1 }} />
              {series.map((s) => (
                <Line
                  key={s.id}
                  dataKey={s.id}
                  name={s.label}
                  stroke={color(s.color)}
                  strokeWidth={s.id === "portfolio" ? 2.5 : 2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartTable rows={rows} series={series} />
      )}

      {!hasPortfolio && emptyNote && <p className="mt-3 text-sm text-ink-muted">{emptyNote}</p>}
    </div>
  );
}

type TooltipEntry = { dataKey?: unknown; value?: unknown };

function ChartTooltip({ active, payload, label, series }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: unknown; series: ChartSeries[] }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => typeof p.value === "number")
    .map((p) => ({ id: String(p.dataKey), value: p.value as number, s: series.find((x) => x.id === p.dataKey) }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md bg-surface px-3.5 py-3 text-sm shadow-pop">
      <div className="mb-1.5 text-ink-muted">{dateFmt(String(label), { day: "numeric", month: "long", year: "numeric" })}</div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 py-0.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: color(r.s?.color ?? "series-5") }} aria-hidden />
          <span className="tabular min-w-[4.5rem] text-ink">{pct(r.value)}</span>
          <span className="text-ink-muted">{r.s?.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Tabellvy: sista handelsdagen per månad (eller vecka för korta perioder) */
function ChartTable({ rows, series }: { rows: Row[]; series: ChartSeries[] }) {
  const short = rows.length <= 70;
  const picked = rows.filter((r, i) => {
    const next = rows[i + 1];
    if (!next) return true;
    return short ? new Date(`${next.date}T12:00:00Z`).getUTCDay() < new Date(`${r.date}T12:00:00Z`).getUTCDay() : next.date.slice(0, 7) !== r.date.slice(0, 7);
  });
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Utveckling från periodens start</caption>
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-ink-muted">
            <th className="py-2 font-normal">Datum</th>
            {series.map((s) => (
              <th key={s.id} className="py-2 text-right font-normal">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {picked.map((r) => (
            <tr key={r.date} className="border-t border-line">
              <td className="py-2 text-ink">{dateFmt(r.date, { day: "numeric", month: "short", year: "numeric" })}</td>
              {series.map((s) => {
                const v = r[s.id];
                return (
                  <td key={s.id} className="py-2 text-right text-ink">
                    {typeof v === "number" ? pct(v) : "–"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
