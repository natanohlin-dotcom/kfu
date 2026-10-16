import type { PricePoint } from "./types";

/** Perioder för kursgraf och avkastningstabell på bolagssidan (som Avanza). */
export const PERIODS = [
  { id: "1w", label: "1 v", days: 7 },
  { id: "1m", label: "1 m", days: 30 },
  { id: "3m", label: "3 m", days: 91 },
  { id: "ytd", label: "I år", days: null },
  { id: "1y", label: "1 år", days: 365 },
  { id: "3y", label: "3 år", days: 1096 },
  { id: "5y", label: "5 år", days: 1826 },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export function isPeriod(v: unknown): v is PeriodId {
  return PERIODS.some((p) => p.id === v);
}

/** Första dag som ingår i perioden (ISO-datum) */
export function periodStart(id: PeriodId, today = new Date()): string {
  const p = PERIODS.find((x) => x.id === id)!;
  if (p.days === null) return `${today.getUTCFullYear() - 1}-12-31`;
  return new Date(today.getTime() - p.days * 86_400_000).toISOString().slice(0, 10);
}

/** Punkterna från sista handelsdagen före periodens start och framåt */
export function slicePeriod(points: PricePoint[], id: PeriodId, today = new Date()): PricePoint[] {
  const start = periodStart(id, today);
  const i = points.findIndex((p) => p.date > start);
  if (i === -1) return [];
  return points.slice(Math.max(0, i - 1));
}

/** Avkastning över perioden med justerade kurser (utdelningar inräknade). null om historiken inte räcker. */
export function periodReturn(points: PricePoint[], id: PeriodId, today = new Date()): number | null {
  const start = periodStart(id, today);
  const before = points.filter((p) => p.date <= start).at(-1);
  const last = points.at(-1);
  if (!before || !last || before.adjClose === 0) return null;
  return last.adjClose / before.adjClose - 1;
}
