/**
 * Tunn klient mot Yahoo Finance (inofficiellt API, samma ändpunkter som yfinance).
 * Används bara av yahoo-provider.ts; resten av appen går via MarketDataProvider (PLAN.md §8).
 * Verifierat från Cloudflare i fas 0 (PLAN.md §15).
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const BASE_HEADERS: HeadersInit = {
  "User-Agent": UA,
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const SESSION_KEY = "yahoo.session";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type YahooSession = { cookie: string; crumb: string; fetchedAt: string };

/** Ett anrop mot Yahoo, med det som behövs för att bedöma om ändpunkten går att använda. */
export type YahooCall<T = unknown> = {
  url: string;
  status: number;
  ms: number;
  bytes: number;
  data: T | null;
  error?: string;
};

async function call<T>(url: string, headers: HeadersInit = {}): Promise<YahooCall<T>> {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { ...BASE_HEADERS, ...headers } });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { url, status: res.status, ms, bytes: text.length, data: null, error: text.slice(0, 300) };
    }
    try {
      return { url, status: res.status, ms, bytes: text.length, data: JSON.parse(text) as T };
    } catch {
      return { url, status: res.status, ms, bytes: text.length, data: null, error: `Inte JSON: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { url, status: 0, ms: Date.now() - started, bytes: 0, data: null, error: String(err) };
  }
}

/** Plockar ut "namn=värde" ur Set-Cookie-rubriker. */
function cookiesFrom(res: Response): string[] {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).filter(Boolean);
}

export type SessionAttempt = {
  session: YahooSession | null;
  steps: { step: string; status: number; ms: number; note: string }[];
};

/**
 * Hämtar cookie + crumb (krävs för quote, quoteSummary och fundamentals-timeseries).
 * 1) fc.yahoo.com sätter cookien A3 (svarar normalt 404, det är förväntat).
 * 2) Om det inte gav någon cookie: prova finance.yahoo.com (kan ge EU-samtyckesvägg).
 * 3) getcrumb med cookien.
 */
export async function createSession(): Promise<SessionAttempt> {
  const steps: SessionAttempt["steps"] = [];
  let cookies: string[] = [];

  for (const url of ["https://fc.yahoo.com/", "https://finance.yahoo.com/"]) {
    const started = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "manual" });
      await res.body?.cancel();
      const got = cookiesFrom(res);
      const location = res.headers.get("location");
      steps.push({
        step: url,
        status: res.status,
        ms: Date.now() - started,
        note: `${got.length} cookies (${got.map((c) => c.split("=")[0]).join(", ") || "inga"})` +
          (location ? `, redirect → ${location.slice(0, 80)}` : ""),
      });
      cookies = cookies.concat(got);
      if (got.some((c) => c.startsWith("A3="))) break;
    } catch (err) {
      steps.push({ step: url, status: 0, ms: Date.now() - started, note: String(err) });
    }
  }

  if (cookies.length === 0) return { session: null, steps };

  const cookie = cookies.join("; ");
  const started = Date.now();
  const res = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...BASE_HEADERS, Cookie: cookie },
  });
  const crumb = (await res.text()).trim();
  const valid = res.ok && crumb.length > 0 && crumb.length < 50 && !crumb.includes("<");
  steps.push({
    step: "getcrumb",
    status: res.status,
    ms: Date.now() - started,
    note: valid ? "crumb mottagen" : `ogiltigt svar: ${crumb.slice(0, 120)}`,
  });

  return { session: valid ? { cookie, crumb, fetchedAt: new Date().toISOString() } : null, steps };
}

/** Sessionen från D1 om den är färsk, annars en ny som sparas. */
export async function getSession(db: D1Database, force = false): Promise<SessionAttempt> {
  if (!force) {
    const row = await db.prepare("SELECT value FROM app_state WHERE key = ?").bind(SESSION_KEY).first<{ value: string }>();
    if (row) {
      const saved = JSON.parse(row.value) as YahooSession;
      if (Date.now() - Date.parse(saved.fetchedAt) < SESSION_MAX_AGE_MS) {
        return { session: saved, steps: [{ step: "från D1", status: 200, ms: 0, note: `hämtad ${saved.fetchedAt}` }] };
      }
    }
  }
  const attempt = await createSession();
  if (attempt.session) {
    await db
      .prepare(
        "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      )
      .bind(SESSION_KEY, JSON.stringify(attempt.session), attempt.session.fetchedAt)
      .run();
  }
  return attempt;
}

const enc = encodeURIComponent;

// ---------- Ändpunkter utan crumb ----------

export type ChartMeta = {
  currency: string;
  symbol: string;
  exchangeName: string;
  fullExchangeName?: string;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  /** Sekunder från UTC för börsens tidszon */
  gmtoffset?: number;
};

export type ChartResponse = {
  chart: {
    result:
      | {
          meta: ChartMeta;
          timestamp?: number[];
          indicators: { quote: { close: (number | null)[] }[]; adjclose?: { adjclose: (number | null)[] }[] };
        }[]
      | null;
    error: unknown;
  };
};

export function chart(symbol: string, range = "1y", interval = "1d") {
  return call<ChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${enc(symbol)}?range=${range}&interval=${interval}&events=div%2Csplit`,
  );
}

export type SearchResponse = {
  quotes: { symbol: string; shortname?: string; longname?: string; exchange?: string; exchDisp?: string; quoteType?: string }[];
};

export function search(q: string) {
  return call<SearchResponse>(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${enc(q)}&quotesCount=8&newsCount=0&listsCount=0`,
  );
}

// ---------- Ändpunkter med crumb ----------

export type YahooQuote = {
  symbol: string;
  longName?: string;
  shortName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  quoteType?: string;
  fullExchangeName?: string;
  financialCurrency?: string;
};

export function quote(symbols: string[], s: YahooSession) {
  return call<{ quoteResponse: { result: YahooQuote[] } }>(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${enc(symbols.join(","))}&crumb=${enc(s.crumb)}`,
    { Cookie: s.cookie },
  );
}

export function quoteSummary(symbol: string, modules: string[], s: YahooSession) {
  return call<{ quoteSummary: { result: Record<string, unknown>[] | null; error: unknown } }>(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${enc(symbol)}?modules=${enc(modules.join(","))}&crumb=${enc(s.crumb)}`,
    { Cookie: s.cookie },
  );
}

/** Rader som DCF-modellen behöver (motsvarar ticker.financials / ticker.cashflow / balance_sheet i yfinance). */
export const DCF_TIMESERIES_TYPES = [
  "annualTotalRevenue",
  "annualEBIT",
  "annualPretaxIncome",
  "annualTaxProvision",
  "annualTaxRateForCalcs",
  "annualDepreciationAndAmortization",
  "annualCapitalExpenditure",
  "annualChangeInWorkingCapital",
  "annualOrdinarySharesNumber",
  "annualShareIssued",
  "annualTreasurySharesNumber",
];

export type TimeseriesResponse = {
  timeseries: {
    result: ({ meta: { type: string[] } } & Record<string, unknown>)[] | null;
    error: unknown;
  };
};

export function timeseries(symbol: string, types: string[], s: YahooSession | null) {
  const period1 = Math.floor(Date.UTC(2015, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const crumb = s ? `&crumb=${enc(s.crumb)}` : "";
  return call<TimeseriesResponse>(
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${enc(symbol)}` +
      `?symbol=${enc(symbol)}&type=${enc(types.join(","))}&period1=${period1}&period2=${period2}${crumb}`,
    s ? { Cookie: s.cookie } : {},
  );
}
