import * as yahoo from "./yahoo";
import { DETAIL_MODULES, normalizeDetails } from "./yahoo-details";
import {
  MarketDataError,
  type HistoryRange,
  type MarketDataProvider,
  type PriceHistory,
  type Quote,
  type SearchHit,
  type SecurityKind,
  type SecurityProfile,
} from "./types";

/**
 * MarketDataProvider mot Yahoo. Rena normaliseringsfunktioner exporteras för tester.
 * Kurs och profil går i första hand via chart (kräver ingen crumb, mest robust);
 * quote/quoteSummary används när de fungerar och ger mer data.
 */

const YAHOO_KINDS: Record<string, SecurityKind> = {
  EQUITY: "stock",
  ETF: "etf",
  MUTUALFUND: "fund",
  INDEX: "index",
  CURRENCY: "fx",
};

export function kindFromYahoo(type: string | undefined): SecurityKind {
  return (type && YAHOO_KINDS[type.toUpperCase()]) || "other";
}

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizeSearch(d: yahoo.SearchResponse): SearchHit[] {
  return d.quotes
    .filter((q) => q.symbol && q.quoteType && q.quoteType.toUpperCase() in YAHOO_KINDS)
    .map((q) => ({
      symbol: q.symbol.toUpperCase(),
      name: q.longname ?? q.shortname ?? q.symbol,
      kind: kindFromYahoo(q.quoteType),
      exchange: q.exchDisp ?? q.exchange ?? null,
    }));
}

/** Tidsstämplar (UTC-sekunder) → handelsdag i börsens tidszon. Sista värdet per dag vinner. */
export function normalizeChart(d: yahoo.ChartResponse): PriceHistory {
  const r = d.chart.result?.[0];
  if (!r) throw new MarketDataError(`Ingen kursdata: ${JSON.stringify(d.chart.error).slice(0, 120)}`, 404);
  const offset = r.meta.gmtoffset ?? 0;
  const closes = r.indicators.quote[0]?.close ?? [];
  const adj = r.indicators.adjclose?.[0]?.adjclose ?? [];
  const byDate = new Map<string, { date: string; close: number; adjClose: number }>();
  (r.timestamp ?? []).forEach((t, i) => {
    const close = finite(closes[i]);
    if (close === null) return;
    const date = new Date((t + offset) * 1000).toISOString().slice(0, 10);
    byDate.set(date, { date, close, adjClose: finite(adj[i]) ?? close });
  });
  return {
    symbol: r.meta.symbol.toUpperCase(),
    currency: r.meta.currency,
    points: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function quoteFromChartMeta(m: yahoo.ChartMeta): Quote {
  const prev = finite(m.chartPreviousClose) ?? finite(m.previousClose);
  return {
    symbol: m.symbol.toUpperCase(),
    name: m.longName ?? m.shortName ?? m.symbol,
    currency: m.currency,
    price: m.regularMarketPrice,
    previousClose: prev,
    changePercent: prev ? m.regularMarketPrice / prev - 1 : null,
    marketCap: null,
    fiftyTwoWeekHigh: finite(m.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: finite(m.fiftyTwoWeekLow),
    marketTime: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
  };
}

export function normalizeQuote(q: yahoo.YahooQuote): Quote | null {
  const price = finite(q.regularMarketPrice);
  if (price === null) return null;
  const pct = finite(q.regularMarketChangePercent);
  return {
    symbol: q.symbol.toUpperCase(),
    name: q.longName ?? q.shortName ?? q.symbol,
    currency: q.currency ?? "",
    price,
    previousClose: finite(q.regularMarketPreviousClose),
    changePercent: pct === null ? null : pct / 100,
    marketCap: finite(q.marketCap),
    fiftyTwoWeekHigh: finite(q.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: finite(q.fiftyTwoWeekLow),
    marketTime: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
  };
}

function failed(r: yahoo.YahooCall, what: string): MarketDataError {
  return new MarketDataError(`Yahoo ${what}: ${r.status || "nätverksfel"} ${r.error?.slice(0, 120) ?? ""}`.trim(), r.status === 404 ? 404 : 502);
}

export function createYahooProvider(db: D1Database): MarketDataProvider {
  /** Kör ett crumb-anrop; vid 401/403 hämtas ny session en gång. */
  async function withSession<T>(fn: (s: yahoo.YahooSession) => Promise<yahoo.YahooCall<T>>): Promise<yahoo.YahooCall<T> | null> {
    for (const force of [false, true]) {
      const { session } = await yahoo.getSession(db, force);
      if (!session) return null;
      const r = await fn(session);
      if (r.status !== 401 && r.status !== 403) return r;
    }
    return null;
  }

  return {
    async search(query) {
      const r = await yahoo.search(query);
      if (!r.data) throw failed(r, "sökning");
      return normalizeSearch(r.data);
    },

    async quotes(symbols) {
      if (symbols.length === 0) return [];
      const r = await withSession((s) => yahoo.quote(symbols, s));
      const found = new Map<string, Quote>();
      for (const q of r?.data?.quoteResponse.result ?? []) {
        const n = normalizeQuote(q);
        if (n) found.set(n.symbol, n);
      }
      // Reserv: chart-metadata för det quote inte gav (fungerar utan crumb)
      for (const symbol of symbols.filter((s) => !found.has(s))) {
        const c = await yahoo.chart(symbol, "5d");
        const meta = c.data?.chart.result?.[0]?.meta;
        if (meta) found.set(symbol, quoteFromChartMeta(meta));
      }
      return symbols.flatMap((s) => found.get(s) ?? []);
    },

    async history(symbol, range: HistoryRange) {
      const r = await yahoo.chart(symbol, range, "1d");
      if (!r.data) throw failed(r, `kurshistorik ${symbol}`);
      return normalizeChart(r.data);
    },

    async profile(symbol): Promise<SecurityProfile> {
      const c = await yahoo.chart(symbol, "5d");
      const meta = c.data?.chart.result?.[0]?.meta;
      if (!meta) throw c.data ? new MarketDataError(`Okänd symbol: ${symbol}`, 404) : failed(c, `profil ${symbol}`);
      const kind = kindFromYahoo(meta.instrumentType);
      const profile: SecurityProfile = {
        symbol: meta.symbol.toUpperCase(),
        name: meta.longName ?? meta.shortName ?? meta.symbol,
        kind,
        currency: meta.currency,
        exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
        country: null,
        sector: null,
        financialCurrency: null,
      };
      if (kind === "stock") {
        // Land, sektor och rapportvaluta finns bara i quoteSummary (kräver crumb). Saknas de går det bra ändå.
        const qs = await withSession((s) => yahoo.quoteSummary(symbol, ["assetProfile", "financialData"], s));
        const res = qs?.data?.quoteSummary.result?.[0] as
          | { assetProfile?: { country?: string; sector?: string }; financialData?: { financialCurrency?: string } }
          | undefined;
        profile.country = res?.assetProfile?.country ?? null;
        profile.sector = res?.assetProfile?.sector ?? null;
        const fc = res?.financialData?.financialCurrency ?? null;
        profile.financialCurrency = fc && fc !== profile.currency ? fc : null;
      }
      return profile;
    },

    async details(symbol) {
      const r = await withSession((s) => yahoo.quoteSummary(symbol, DETAIL_MODULES, s));
      if (!r) throw new MarketDataError("Yahoo: ingen session (cookie/crumb) för nyckeltal");
      const res = r.data?.quoteSummary.result?.[0];
      if (!res) throw r.data ? new MarketDataError(`Inga nyckeltal för ${symbol}`, 404) : failed(r, `nyckeltal ${symbol}`);
      return normalizeDetails(symbol, res);
    },
  };
}
