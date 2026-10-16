import type { AnalystEstimate, CompanyDetails, RecommendationCounts } from "./types";

/**
 * Yahoos quoteSummary → CompanyDetails. Ren funktion (testas med fixtur i tests/).
 * Yahoo skickar tal som { raw, fmt }; några fält är procent i stället för andel (markerade nedan).
 */

export const DETAIL_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "assetProfile",
  "calendarEvents",
  "majorHoldersBreakdown",
  "institutionOwnership",
  "recommendationTrend",
  "earningsTrend",
];

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

export function num(v: unknown): number | null {
  const x = typeof v === "number" ? v : typeof v === "object" && v ? (v as { raw?: unknown }).raw : null;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** Epoch-sekunder (eller { raw }) → YYYY-MM-DD */
export function day(v: unknown): string | null {
  const s = num(v);
  return s && s > 0 ? new Date(s * 1000).toISOString().slice(0, 10) : null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const pctToFraction = (v: number | null) => (v === null ? null : v / 100);

/** recommendationTrend.trend: [{ period: "0m" | "-1m" …, strongBuy, buy, hold, sell, strongSell }] */
export function normalizeRecommendationTrend(module: unknown): RecommendationCounts[] {
  const trend = obj(module).trend;
  if (!Array.isArray(trend)) return [];
  return (trend as Obj[])
    .flatMap((t) => {
      const m = /^(-?\d+)m$/.exec(String(t.period ?? ""));
      if (!m) return [];
      const c = (k: string) => num(t[k]) ?? 0;
      const row = { monthsAgo: Math.abs(Number(m[1])), strongBuy: c("strongBuy"), buy: c("buy"), hold: c("hold"), sell: c("sell"), strongSell: c("strongSell") };
      return row.strongBuy + row.buy + row.hold + row.sell + row.strongSell > 0 ? [row] : [];
    })
    .sort((a, b) => a.monthsAgo - b.monthsAgo);
}

const PERIODS: Record<string, Pick<AnalystEstimate, "kind" | "offset">> = {
  "0q": { kind: "quarter", offset: 0 },
  "+1q": { kind: "quarter", offset: 1 },
  "0y": { kind: "year", offset: 0 },
  "+1y": { kind: "year", offset: 1 },
};

/** earningsTrend.trend: [{ period: "0q" | "+1q" | "0y" | "+1y" | …, endDate, earningsEstimate, revenueEstimate }] */
export function normalizeEstimates(module: unknown): AnalystEstimate[] {
  const trend = obj(module).trend;
  if (!Array.isArray(trend)) return [];
  return (trend as Obj[]).flatMap((t) => {
    const period = PERIODS[String(t.period ?? "")];
    if (!period) return [];
    const e = obj(t.earningsEstimate);
    const r = obj(t.revenueEstimate);
    const est: AnalystEstimate = {
      ...period,
      endDate: str(t.endDate),
      eps: { avg: num(e.avg), low: num(e.low), high: num(e.high), yearAgo: num(e.yearAgoEps), analysts: num(e.numberOfAnalysts), growth: num(e.growth) },
      revenue: { avg: num(r.avg), low: num(r.low), high: num(r.high), yearAgo: num(r.yearAgoRevenue), analysts: num(r.numberOfAnalysts), growth: num(r.growth) },
    };
    return est.eps.avg !== null || est.revenue.avg !== null ? [est] : [];
  });
}

export function normalizeDetails(symbol: string, r: Obj): CompanyDetails {
  const price = obj(r.price);
  const sd = obj(r.summaryDetail);
  const ks = obj(r.defaultKeyStatistics);
  const fd = obj(r.financialData);
  const ap = obj(r.assetProfile);
  const cal = obj(r.calendarEvents);
  const mh = obj(r.majorHoldersBreakdown);
  const io = obj(r.institutionOwnership);

  const currency = str(price.currency) ?? str(sd.currency) ?? "";
  const financialCurrency = str(fd.financialCurrency);
  const officers = Array.isArray(ap.companyOfficers) ? (ap.companyOfficers as Obj[]) : [];
  const ceo = officers.find((o) => /\b(CEO|Chief Executive)/i.test(String(o.title ?? ""))) ?? null;
  const earnings = obj(cal.earnings);
  const earningsDates = Array.isArray(earnings.earningsDate) ? (earnings.earningsDate as unknown[]) : [];
  const holders = Array.isArray(io.ownershipList) ? (io.ownershipList as Obj[]) : [];

  return {
    symbol,
    currency,
    financialCurrency: financialCurrency && financialCurrency !== currency ? financialCurrency : null,
    valuation: {
      marketCap: num(price.marketCap) ?? num(sd.marketCap),
      enterpriseValue: num(ks.enterpriseValue),
      trailingPE: num(sd.trailingPE),
      forwardPE: num(sd.forwardPE) ?? num(ks.forwardPE),
      priceToSales: num(sd.priceToSalesTrailing12Months),
      priceToBook: num(ks.priceToBook),
      evToEbitda: num(ks.enterpriseToEbitda),
      evToRevenue: num(ks.enterpriseToRevenue),
      pegRatio: num(ks.pegRatio),
    },
    perShare: {
      trailingEps: num(ks.trailingEps),
      forwardEps: num(ks.forwardEps),
      bookValue: num(ks.bookValue),
      sharesOutstanding: num(ks.sharesOutstanding),
      impliedSharesOutstanding: num(ks.impliedSharesOutstanding),
    },
    trading: {
      open: num(sd.open) ?? num(price.regularMarketOpen),
      dayHigh: num(sd.dayHigh) ?? num(price.regularMarketDayHigh),
      dayLow: num(sd.dayLow) ?? num(price.regularMarketDayLow),
      previousClose: num(sd.previousClose) ?? num(price.regularMarketPreviousClose),
      volume: num(sd.volume) ?? num(price.regularMarketVolume),
      averageVolume: num(sd.averageVolume),
      fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),
      beta: num(sd.beta) ?? num(ks.beta),
    },
    profitability: {
      totalRevenue: num(fd.totalRevenue),
      revenueGrowth: num(fd.revenueGrowth),
      earningsGrowth: num(fd.earningsGrowth),
      grossMargin: num(fd.grossMargins),
      operatingMargin: num(fd.operatingMargins),
      ebitdaMargin: num(fd.ebitdaMargins),
      profitMargin: num(fd.profitMargins) ?? num(ks.profitMargins),
      returnOnEquity: num(fd.returnOnEquity),
      returnOnAssets: num(fd.returnOnAssets),
    },
    financialHealth: {
      totalCash: num(fd.totalCash),
      totalDebt: num(fd.totalDebt),
      // Yahoo anger skuldsättningsgraden i procent (45.3 = 0,453)
      debtToEquity: pctToFraction(num(fd.debtToEquity)),
      currentRatio: num(fd.currentRatio),
      quickRatio: num(fd.quickRatio),
      freeCashflow: num(fd.freeCashflow),
      operatingCashflow: num(fd.operatingCashflow),
    },
    dividend: {
      rate: num(sd.dividendRate) ?? num(sd.trailingAnnualDividendRate),
      yield: num(sd.dividendYield) ?? num(sd.trailingAnnualDividendYield),
      payoutRatio: num(sd.payoutRatio),
      // Femårssnittet anges i procent
      fiveYearAvgYield: pctToFraction(num(sd.fiveYearAvgDividendYield)),
      exDate: day(cal.exDividendDate) ?? day(sd.exDividendDate),
      payDate: day(cal.dividendDate),
    },
    analysts: {
      targetMean: num(fd.targetMeanPrice),
      targetHigh: num(fd.targetHighPrice),
      targetLow: num(fd.targetLowPrice),
      recommendation: str(fd.recommendationKey),
      count: num(fd.numberOfAnalystOpinions),
      recommendationTrend: normalizeRecommendationTrend(r.recommendationTrend),
      estimates: normalizeEstimates(r.earningsTrend),
    },
    calendar: {
      nextEarnings: earningsDates.map(day).filter(Boolean).sort()[0] ?? null,
    },
    ownership: {
      insidersPercent: num(mh.insidersPercentHeld) ?? num(ks.heldPercentInsiders),
      institutionsPercent: num(mh.institutionsPercentHeld) ?? num(ks.heldPercentInstitutions),
      topHolders: holders
        .map((h) => ({ name: str(h.organization) ?? "Okänd", percent: num(h.pctHeld), shares: num(h.position), reportDate: day(h.reportDate) }))
        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
        .slice(0, 10),
    },
    profile: {
      description: str(ap.longBusinessSummary),
      sector: str(ap.sector),
      industry: str(ap.industry),
      employees: num(ap.fullTimeEmployees),
      website: str(ap.website),
      city: str(ap.city),
      country: str(ap.country),
      ceo: ceo ? str(ceo.name) : null,
    },
  };
}
