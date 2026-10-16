/**
 * Leverantörsoberoende typer för marknadsdata (PLAN.md §8). Resten av appen
 * känner bara till dessa och MarketDataProvider, aldrig Yahoos format.
 */

export type SecurityKind = "stock" | "etf" | "fund" | "index" | "fx" | "other";

export const KIND_LABELS: Record<SecurityKind, string> = {
  stock: "Aktie",
  etf: "ETF",
  fund: "Fond",
  index: "Index",
  fx: "Valuta",
  other: "Övrigt",
};

export type SearchHit = {
  symbol: string;
  name: string;
  kind: SecurityKind;
  exchange: string | null;
};

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number | null;
  /** Förändring sedan föregående stängning, som andel (0.012 = +1,2 %) */
  changePercent: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /** ISO 8601 UTC för senaste kurs */
  marketTime: string | null;
};

export type PricePoint = { date: string; close: number; adjClose: number };

export type HistoryRange = "5d" | "1mo" | "3mo" | "6mo" | "ytd" | "1y" | "2y" | "5y" | "10y" | "max";

export type PriceHistory = {
  symbol: string;
  currency: string;
  points: PricePoint[];
};

export type SecurityProfile = {
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  exchange: string | null;
  country: string | null;
  sector: string | null;
  financialCurrency: string | null;
};

export interface MarketDataProvider {
  search(query: string): Promise<SearchHit[]>;
  quotes(symbols: string[]): Promise<Quote[]>;
  history(symbol: string, range: HistoryRange): Promise<PriceHistory>;
  profile(symbol: string): Promise<SecurityProfile>;
  /** Nyckeltal, ägare, kalender och bolagsprofil (bolagssidan) */
  details(symbol: string): Promise<CompanyDetails>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

/** Yahoo-symboler: bokstäver, siffror och . ^ = - (t.ex. 'NOVO-B.CO', '^OMX', 'USDSEK=X') */
export function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return /^[A-Z0-9.^=\-]{1,24}$/.test(s) ? s : null;
}

export type RecommendationCounts = {
  /** Månader bakåt: 0 = nuvarande, 1 = förra månaden … */
  monthsAgo: number;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type AnalystEstimate = {
  /** 'quarter' | 'year' och 0 = innevarande, 1 = nästa */
  kind: "quarter" | "year";
  offset: 0 | 1;
  /** Periodens slutdatum (ISO) */
  endDate: string | null;
  eps: { avg: number | null; low: number | null; high: number | null; yearAgo: number | null; analysts: number | null; growth: number | null };
  revenue: { avg: number | null; low: number | null; high: number | null; yearAgo: number | null; analysts: number | null; growth: number | null };
};

/**
 * Bolagsdetaljer för bolagssidan (motsvarar det Avanza visar). Alla tal kan saknas beroende på
 * värdepapperstyp och källa. Andelar som 0.12 = 12 %, belopp i valutan som anges.
 */
export type CompanyDetails = {
  symbol: string;
  /** Handelsvaluta (kurs, börsvärde) */
  currency: string;
  /** Rapportvaluta (omsättning, kassa, skuld) – kan skilja sig från handelsvalutan */
  financialCurrency: string | null;

  valuation: {
    marketCap: number | null;
    enterpriseValue: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    priceToSales: number | null;
    priceToBook: number | null;
    evToEbitda: number | null;
    evToRevenue: number | null;
    pegRatio: number | null;
  };
  perShare: {
    trailingEps: number | null;
    forwardEps: number | null;
    bookValue: number | null;
    sharesOutstanding: number | null;
    /** Alla aktieslag (A+B), se PLAN.md §15 om Novo */
    impliedSharesOutstanding: number | null;
  };
  trading: {
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    previousClose: number | null;
    volume: number | null;
    averageVolume: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    beta: number | null;
  };
  profitability: {
    totalRevenue: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    ebitdaMargin: number | null;
    profitMargin: number | null;
    returnOnEquity: number | null;
    returnOnAssets: number | null;
  };
  financialHealth: {
    totalCash: number | null;
    totalDebt: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    quickRatio: number | null;
    freeCashflow: number | null;
    operatingCashflow: number | null;
  };
  dividend: {
    rate: number | null;
    yield: number | null;
    payoutRatio: number | null;
    fiveYearAvgYield: number | null;
    /** ISO-datum */
    exDate: string | null;
    payDate: string | null;
  };
  analysts: {
    targetMean: number | null;
    targetHigh: number | null;
    targetLow: number | null;
    /** 'strong_buy' | 'buy' | 'hold' | 'underperform' | 'sell' | 'none' */
    recommendation: string | null;
    count: number | null;
    /** Antal analytiker per rekommendation, nuvarande månad först och sedan bakåt (som Avanzas staplar) */
    recommendationTrend: RecommendationCounts[];
    /** Vinst- och omsättningsestimat per period (innevarande/nästa kvartal och år) */
    estimates: AnalystEstimate[];
  };
  calendar: {
    /** Nästa rapport, ISO-datum (första dagen om Yahoo anger ett intervall) */
    nextEarnings: string | null;
  };
  ownership: {
    insidersPercent: number | null;
    institutionsPercent: number | null;
    /** Största institutionella ägare enligt källan (för nordiska bolag ofta ofullständigt) */
    topHolders: { name: string; percent: number | null; shares: number | null; reportDate: string | null }[];
  };
  profile: {
    description: string | null;
    sector: string | null;
    industry: string | null;
    employees: number | null;
    website: string | null;
    city: string | null;
    country: string | null;
    ceo: string | null;
  };
};
