import type { MarketDataProvider, SecurityKind } from "@/lib/market/types";
import { syncPriceHistory } from "@/lib/market/prices";

/** Värdepappersregistret (tabell securities). Funktionerna tar db som argument så att de fungerar även i cron. */

type SecurityRow = {
  id: number;
  symbol: string;
  name: string;
  kind: string;
  currency: string;
  exchange: string | null;
  country: string | null;
  sector: string | null;
  financial_currency: string | null;
  manual_shares_json: string | null;
  prices_synced_at: string | null;
  created_at: string;
};

export type Security = {
  id: number;
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  exchange: string | null;
  country: string | null;
  sector: string | null;
  financialCurrency: string | null;
  pricesSyncedAt: string | null;
};

const KINDS: SecurityKind[] = ["stock", "etf", "fund", "index", "fx", "other"];

export function rowToSecurity(r: SecurityRow): Security {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    kind: (KINDS as string[]).includes(r.kind) ? (r.kind as SecurityKind) : "other",
    currency: r.currency,
    exchange: r.exchange,
    country: r.country,
    sector: r.sector,
    financialCurrency: r.financial_currency,
    pricesSyncedAt: r.prices_synced_at,
  };
}

export async function findSecurityBySymbol(db: D1Database, symbol: string): Promise<Security | null> {
  const row = await db.prepare("SELECT * FROM securities WHERE symbol = ?").bind(symbol).first<SecurityRow>();
  return row ? rowToSecurity(row) : null;
}

/** Basvalutan för portföljen (PLAN.md §14: SEK om inget annat beslutas). */
export const BASE_CURRENCY = "SEK";

export function fxSymbol(currency: string): string {
  return `${currency.toUpperCase()}${BASE_CURRENCY}=X`;
}

/**
 * Hämtar värdepappret, eller skapar det från källans profil och läser in kurshistoriken.
 * För utländsk valuta läggs även valutakursen (t.ex. DKKSEK=X) in, så att fas 3 kan räkna om till SEK.
 */
export async function ensureSecurity(db: D1Database, market: MarketDataProvider, symbol: string): Promise<Security> {
  const existing = await findSecurityBySymbol(db, symbol);
  if (existing) return existing;

  const p = await market.profile(symbol);
  const row = await db
    .prepare(
      "INSERT INTO securities (symbol, name, kind, currency, exchange, country, sector, financial_currency, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET symbol = excluded.symbol RETURNING *",
    )
    .bind(p.symbol, p.name, p.kind, p.currency, p.exchange, p.country, p.sector, p.financialCurrency, new Date().toISOString())
    .first<SecurityRow>();
  if (!row) throw new Error(`Kunde inte spara ${symbol}`);
  const security = rowToSecurity(row);

  await syncPriceHistory(db, market, security);
  if (security.kind !== "fx" && security.currency && security.currency !== BASE_CURRENCY) {
    await ensureSecurity(db, market, fxSymbol(security.currency));
  }
  return security;
}
