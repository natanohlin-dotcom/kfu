import type { MarketDataProvider, Quote } from "./types";

/**
 * D1-cache framför en MarketDataProvider (PLAN.md §8). Vid fel från källan används
 * ett utgånget värde hellre än inget, så att sidorna fungerar även om Yahoo krånglar.
 */

export const TTL = {
  search: 24 * 3600,
  quote: 15 * 60,
  history: 6 * 3600,
  profile: 7 * 24 * 3600,
  details: 6 * 3600,
} as const;

type Row = { payload_json: string; fetched_at: string; ttl_seconds: number };

async function read<T>(db: D1Database, key: string): Promise<{ value: T; fresh: boolean } | null> {
  const row = await db.prepare("SELECT payload_json, fetched_at, ttl_seconds FROM market_cache WHERE key = ?").bind(key).first<Row>();
  if (!row) return null;
  const fresh = Date.now() - Date.parse(row.fetched_at) < row.ttl_seconds * 1000;
  return { value: JSON.parse(row.payload_json) as T, fresh };
}

function writeStmt(db: D1Database, key: string, value: unknown, ttl: number) {
  return db
    .prepare(
      "INSERT INTO market_cache (key, payload_json, fetched_at, ttl_seconds) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET payload_json = excluded.payload_json, fetched_at = excluded.fetched_at, ttl_seconds = excluded.ttl_seconds",
    )
    .bind(key, JSON.stringify(value), new Date().toISOString(), ttl);
}

async function cached<T>(db: D1Database, key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = await read<T>(db, key);
  if (hit?.fresh) return hit.value;
  try {
    const value = await load();
    await writeStmt(db, key, value, ttl).run();
    return value;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

/**
 * Höj när formatet på något cachat värde ändras (t.ex. nya fält i CompanyDetails),
 * så att gamla poster ignoreras i stället för att ge saknade fält.
 */
export const CACHE_VERSION = 2;

/** prefix skiljer källorna åt (demo- och Yahoo-data ska aldrig blandas i cachen). */
export function withCache(db: D1Database, provider: MarketDataProvider, prefix: string): MarketDataProvider {
  const k = (key: string) => `v${CACHE_VERSION}:${prefix}:${key}`;
  return {
    search: (query) => cached(db, k(`search:${query.trim().toLowerCase()}`), TTL.search, () => provider.search(query)),
    history: (symbol, range) => cached(db, k(`history:${symbol}:${range}`), TTL.history, () => provider.history(symbol, range)),
    profile: (symbol) => cached(db, k(`profile:${symbol}`), TTL.profile, () => provider.profile(symbol)),
    details: (symbol) => cached(db, k(`details:${symbol}`), TTL.details, () => provider.details(symbol)),

    // Kurser cachas per symbol; de som saknas hämtas i ett gemensamt anrop.
    async quotes(symbols) {
      const hits = await Promise.all(symbols.map((s) => read<Quote>(db, k(`quote:${s}`))));
      const missing = symbols.filter((_, i) => !hits[i]?.fresh);
      let fetched: Quote[] = [];
      if (missing.length) {
        try {
          fetched = await provider.quotes(missing);
          if (fetched.length) await db.batch(fetched.map((q) => writeStmt(db, k(`quote:${q.symbol}`), q, TTL.quote)));
        } catch {
          // Faller tillbaka på utgångna värden nedan
        }
      }
      const bySymbol = new Map(fetched.map((q) => [q.symbol, q]));
      return symbols.flatMap((s, i) => bySymbol.get(s) ?? hits[i]?.value ?? []);
    },
  };
}
