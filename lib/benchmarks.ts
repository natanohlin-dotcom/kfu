import type { SecurityKind } from "@/lib/market/types";

/** Jämförelseindex (tabell benchmarks). Färger är tokens ur DESIGN.md §2; series-1 är reserverad för portföljen. */

export const BENCHMARK_COLORS = [
  { token: "series-2", label: "Orange", dot: "bg-series-2" },
  { token: "series-3", label: "Grönblå", dot: "bg-series-3" },
  { token: "series-4", label: "Lila", dot: "bg-series-4" },
  { token: "series-5", label: "Rosa", dot: "bg-series-5" },
] as const;
export type BenchmarkColor = (typeof BENCHMARK_COLORS)[number]["token"];

export function isBenchmarkColor(v: unknown): v is BenchmarkColor {
  return BENCHMARK_COLORS.some((c) => c.token === v);
}

export function colorDotClass(token: string): string {
  return BENCHMARK_COLORS.find((c) => c.token === token)?.dot ?? "bg-series-5";
}

export type Benchmark = {
  id: number;
  label: string;
  color: BenchmarkColor;
  isDefault: boolean;
  sortOrder: number;
  security: { id: number; symbol: string; name: string; kind: SecurityKind; currency: string };
  lastClose: number | null;
  lastDate: string | null;
  /** Avkastning i år (mot sista stängning föregående år), som andel */
  ytd: number | null;
};

type Row = {
  id: number;
  label: string;
  color: string;
  is_default: number;
  sort_order: number;
  security_id: number;
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  last_close: number | null;
  last_date: string | null;
  year_start_close: number | null;
};

export async function listBenchmarks(db: D1Database, today = new Date()): Promise<Benchmark[]> {
  const yearStart = `${today.getUTCFullYear()}-01-01`;
  const { results } = await db
    .prepare(
      `SELECT b.id, b.label, b.color, b.is_default, b.sort_order,
              s.id AS security_id, s.symbol, s.name, s.kind, s.currency,
              (SELECT adj_close FROM price_history WHERE security_id = s.id ORDER BY date DESC LIMIT 1) AS last_close,
              (SELECT date FROM price_history WHERE security_id = s.id ORDER BY date DESC LIMIT 1) AS last_date,
              (SELECT adj_close FROM price_history WHERE security_id = s.id AND date < ? ORDER BY date DESC LIMIT 1) AS year_start_close
       FROM benchmarks b JOIN securities s ON s.id = b.security_id
       ORDER BY b.sort_order, b.id`,
    )
    .bind(yearStart)
    .all<Row>();
  return results.map((r) => ({
    id: r.id,
    label: r.label,
    color: isBenchmarkColor(r.color) ? r.color : "series-5",
    isDefault: r.is_default === 1,
    sortOrder: r.sort_order,
    security: { id: r.security_id, symbol: r.symbol, name: r.name, kind: r.kind, currency: r.currency },
    lastClose: r.last_close,
    lastDate: r.last_date,
    ytd: r.last_close && r.year_start_close ? r.last_close / r.year_start_close - 1 : null,
  }));
}

/** Nästa lediga färg (så att nya index inte får samma färg som befintliga). */
export function nextColor(used: string[]): BenchmarkColor {
  return BENCHMARK_COLORS.find((c) => !used.includes(c.token))?.token ?? "series-5";
}
