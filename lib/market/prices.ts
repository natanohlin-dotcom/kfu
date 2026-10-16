import type { HistoryRange, MarketDataProvider, PricePoint } from "./types";

/**
 * Kurshistorik i D1 (tabell price_history) och den dagliga uppdateringen (PLAN.md §8).
 * Varje synk hämtar från senast sparade dag och skriver över den (pågående dag ersätts med stängningskurs).
 */

type SyncTarget = { id: number; symbol: string };

/** Minsta Yahoo-intervall som täcker tiden sedan senast sparade dag. */
export function rangeSince(lastDate: string | null, today = new Date()): HistoryRange {
  if (!lastDate) return "10y";
  const days = (today.getTime() - Date.parse(`${lastDate}T00:00:00Z`)) / 86_400_000;
  if (days <= 4) return "5d";
  if (days <= 27) return "1mo";
  if (days <= 85) return "3mo";
  if (days <= 360) return "1y";
  if (days <= 1800) return "5y";
  return "10y";
}

/** D1 tillåter 100 bundna parametrar per fråga: 4 per rad → 25 rader per INSERT. */
const ROWS_PER_INSERT = 25;

export function upsertStatements(db: D1Database, securityId: number, points: PricePoint[]): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < points.length; i += ROWS_PER_INSERT) {
    const chunk = points.slice(i, i + ROWS_PER_INSERT);
    stmts.push(
      db
        .prepare(`INSERT OR REPLACE INTO price_history (security_id, date, close, adj_close) VALUES ${chunk.map(() => "(?, ?, ?, ?)").join(", ")}`)
        .bind(...chunk.flatMap((p) => [securityId, p.date, p.close, p.adjClose])),
    );
  }
  return stmts;
}

export async function syncPriceHistory(db: D1Database, market: MarketDataProvider, s: SyncTarget): Promise<number> {
  const last = await db
    .prepare("SELECT MAX(date) AS date FROM price_history WHERE security_id = ?")
    .bind(s.id)
    .first<{ date: string | null }>();
  const history = await market.history(s.symbol, rangeSince(last?.date ?? null));
  const points = last?.date ? history.points.filter((p) => p.date >= last.date!) : history.points;
  await db.batch([
    ...upsertStatements(db, s.id, points),
    db.prepare("UPDATE securities SET prices_synced_at = ? WHERE id = ?").bind(new Date().toISOString(), s.id),
  ]);
  return points.length;
}

export type PriceUpdateResult = {
  ranAt: string;
  updated: { symbol: string; rows: number }[];
  failed: { symbol: string; error: string }[];
  remaining: number;
};

/**
 * Daglig uppdatering av alla värdepapper, äldst synkade först. Workers gratisnivå tillåter 50
 * utgående anrop per körning, så högst MAX_PER_RUN tas per gång; resten tas nästa körning.
 */
const MAX_PER_RUN = 40;

export async function runDailyPriceUpdate(db: D1Database, market: MarketDataProvider): Promise<PriceUpdateResult> {
  const { results } = await db
    .prepare("SELECT id, symbol FROM securities ORDER BY prices_synced_at IS NOT NULL, prices_synced_at LIMIT ?")
    .bind(MAX_PER_RUN + 1)
    .all<SyncTarget>();
  const batch = results.slice(0, MAX_PER_RUN);
  const result: PriceUpdateResult = { ranAt: new Date().toISOString(), updated: [], failed: [], remaining: 0 };

  for (const s of batch) {
    try {
      result.updated.push({ symbol: s.symbol, rows: await syncPriceHistory(db, market, s) });
    } catch (err) {
      result.failed.push({ symbol: s.symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }
  const total = await db.prepare("SELECT COUNT(*) AS n FROM securities").first<{ n: number }>();
  result.remaining = Math.max(0, (total?.n ?? 0) - batch.length);

  await db
    .prepare(
      "INSERT INTO app_state (key, value, updated_at) VALUES ('cron.prices.last_run', ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(JSON.stringify(result), result.ranAt)
    .run();
  return result;
}

export async function lastPriceUpdate(db: D1Database): Promise<PriceUpdateResult | null> {
  const row = await db.prepare("SELECT value FROM app_state WHERE key = 'cron.prices.last_run'").first<{ value: string }>();
  return row ? (JSON.parse(row.value) as PriceUpdateResult) : null;
}
