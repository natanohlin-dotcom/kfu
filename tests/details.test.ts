import { describe, expect, it } from "vitest";
import { createDemoProvider } from "@/lib/market/demo-provider";
import { periodReturn, slicePeriod } from "@/lib/market/returns";
import { normalizeDetails, normalizeEstimates, normalizeRecommendationTrend } from "@/lib/market/yahoo-details";

// Utdrag i Yahoos quoteSummary-format ({ raw, fmt }), förkortat men med riktiga fältnamn
const r = (raw: number) => ({ raw, fmt: String(raw) });
const fixture = {
  price: { currency: "DKK", marketCap: r(1162633936896), regularMarketOpen: r(260.1) },
  summaryDetail: {
    trailingPE: r(14.2), forwardPE: r(12.9), priceToSalesTrailing12Months: r(3.8), dividendRate: r(11.4), dividendYield: r(0.0433),
    payoutRatio: r(0.48), fiveYearAvgDividendYield: r(1.62), beta: r(0.2), volume: r(5200000), averageVolume: r(6100000),
    dayHigh: r(265), dayLow: r(259.5), previousClose: r(258.9), fiftyTwoWeekHigh: r(700), fiftyTwoWeekLow: r(240), exDividendDate: r(1774224000),
  },
  defaultKeyStatistics: {
    enterpriseValue: r(1250000000000), priceToBook: r(8.1), enterpriseToEbitda: r(9.4), enterpriseToRevenue: r(3.9),
    trailingEps: r(18.55), forwardEps: r(20.4), bookValue: r(32.5), sharesOutstanding: r(3338238124), impliedSharesOutstanding: r(4413110124),
    heldPercentInsiders: r(0.001), heldPercentInstitutions: r(0.12),
  },
  financialData: {
    financialCurrency: "DKK", totalRevenue: r(305000000000), revenueGrowth: r(0.09), grossMargins: r(0.84), operatingMargins: r(0.43),
    profitMargins: r(0.34), returnOnEquity: r(0.78), totalCash: r(44982001664), totalDebt: r(140126994432), debtToEquity: r(78.5),
    currentRatio: r(0.82), freeCashflow: r(52000000000), targetMeanPrice: r(330), targetHighPrice: r(520), targetLowPrice: r(240),
    recommendationKey: "buy", numberOfAnalystOpinions: r(24),
  },
  assetProfile: {
    sector: "Healthcare", industry: "Biotechnology", fullTimeEmployees: 77349, website: "https://www.novonordisk.com",
    city: "Bagsværd", country: "Denmark", longBusinessSummary: "Novo Nordisk A/S engages in research…",
    companyOfficers: [{ name: "Mr. Karsten Munk Knudsen", title: "CFO & Executive VP" }, { name: "Mr. Maziar Mike Doustdar", title: "President, CEO & Member of Management Board" }],
  },
  calendarEvents: { earnings: { earningsDate: [r(1793606400), r(1793260800)] }, exDividendDate: r(1774224000), dividendDate: r(1774396800) },
  majorHoldersBreakdown: { insidersPercentHeld: r(0.0012), institutionsPercentHeld: r(0.1234) },
  institutionOwnership: {
    ownershipList: [
      { organization: "Vanguard Group Inc", pctHeld: r(0.0125), position: r(41000000), reportDate: r(1782777600) },
      { organization: "Blackrock Inc.", pctHeld: r(0.0201), position: r(67000000), reportDate: r(1782777600) },
    ],
  },
};

describe("normalizeDetails", () => {
  const d = normalizeDetails("NOVO-B.CO", fixture);

  it("läser värdering, per aktie och handel", () => {
    expect(d.currency).toBe("DKK");
    expect(d.financialCurrency).toBeNull(); // samma som handelsvalutan
    expect(d.valuation).toMatchObject({ marketCap: 1162633936896, trailingPE: 14.2, priceToSales: 3.8, priceToBook: 8.1, evToEbitda: 9.4 });
    expect(d.perShare.impliedSharesOutstanding).toBe(4413110124);
    expect(d.trading).toMatchObject({ open: 260.1, dayHigh: 265, volume: 5200000, beta: 0.2 });
  });

  it("gör om procentfält till andelar", () => {
    expect(d.financialHealth.debtToEquity).toBeCloseTo(0.785);
    expect(d.dividend.fiveYearAvgYield).toBeCloseTo(0.0162);
    expect(d.dividend.yield).toBe(0.0433);
  });

  it("hittar VD, tidigaste rapportdatum och sorterar ägare efter andel", () => {
    expect(d.profile.ceo).toBe("Mr. Maziar Mike Doustdar");
    expect(d.calendar.nextEarnings).toBe(new Date(1793260800 * 1000).toISOString().slice(0, 10));
    expect(d.ownership.topHolders.map((h) => h.name)).toEqual(["Blackrock Inc.", "Vanguard Group Inc"]);
    expect(d.ownership.institutionsPercent).toBe(0.1234);
    expect(d.analysts).toMatchObject({ recommendation: "buy", count: 24, targetMean: 330 });
  });

  it("klarar ett index utan bolagsmoduler", () => {
    const idx = normalizeDetails("^OMX", { price: { currency: "SEK" }, summaryDetail: { dayHigh: r(3260), volume: r(0) } });
    expect(idx.valuation.trailingPE).toBeNull();
    expect(idx.profile.description).toBeNull();
    expect(idx.ownership.topHolders).toEqual([]);
    expect(idx.trading.dayHigh).toBe(3260);
  });
});

describe("analytikerdata", () => {
  it("läser rekommendationstrenden, nuvarande månad först, och hoppar över tomma månader", () => {
    const trend = normalizeRecommendationTrend({
      trend: [
        { period: "-1m", strongBuy: 4, buy: 9, hold: 8, sell: 1, strongSell: 0 },
        { period: "0m", strongBuy: 5, buy: 10, hold: 7, sell: 1, strongSell: 1 },
        { period: "-2m", strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 },
        { period: "-3m", strongBuy: 3, buy: 9, hold: 9, sell: 2, strongSell: 0 },
      ],
    });
    expect(trend.map((t) => t.monthsAgo)).toEqual([0, 1, 3]);
    expect(trend[0]).toEqual({ monthsAgo: 0, strongBuy: 5, buy: 10, hold: 7, sell: 1, strongSell: 1 });
    expect(normalizeRecommendationTrend(undefined)).toEqual([]);
  });

  it("läser vinst- och omsättningsestimat för kvartal och år och ignorerar långsiktiga perioder", () => {
    const est = normalizeEstimates({
      trend: [
        { period: "0y", endDate: "2026-12-31", earningsEstimate: { avg: r(23.1), low: r(21.9), high: r(24.5), yearAgoEps: r(22.6), numberOfAnalysts: r(21), growth: r(0.022) }, revenueEstimate: { avg: r(309e9), numberOfAnalysts: r(20), growth: r(0.01) } },
        { period: "+1y", endDate: "2027-12-31", earningsEstimate: { avg: r(24.8), numberOfAnalysts: r(20), growth: r(0.074) }, revenueEstimate: { avg: r(321e9) } },
        { period: "+5y", endDate: null, growth: r(0.05), earningsEstimate: {}, revenueEstimate: {} },
        { period: "0q", endDate: "2026-12-31", earningsEstimate: {}, revenueEstimate: {} },
      ],
    });
    expect(est.map((e) => [e.kind, e.offset, e.endDate])).toEqual([["year", 0, "2026-12-31"], ["year", 1, "2027-12-31"]]);
    expect(est[0].eps).toMatchObject({ avg: 23.1, low: 21.9, high: 24.5, yearAgo: 22.6, analysts: 21, growth: 0.022 });
    expect(est[1].revenue.avg).toBe(321e9);
  });

  it("kopplas in i normalizeDetails", () => {
    const d = normalizeDetails("X", { recommendationTrend: { trend: [{ period: "0m", buy: 2, hold: 1 }] } });
    expect(d.analysts.recommendationTrend[0]).toMatchObject({ buy: 2, hold: 1, strongBuy: 0 });
    expect(d.analysts.estimates).toEqual([]);
  });

  it("demodatans fördelning summerar till antalet analytiker", async () => {
    const d = await createDemoProvider().details("ERIC-B.ST");
    const now = d.analysts.recommendationTrend[0];
    expect(now.strongBuy + now.buy + now.hold + now.sell + now.strongSell).toBe(d.analysts.count);
    expect(d.analysts.estimates.length).toBe(4);
  });
});

describe("periodavkastning", () => {
  const pts = [
    { date: "2025-12-30", close: 100, adjClose: 100 },
    { date: "2025-12-31", close: 110, adjClose: 110 },
    { date: "2026-06-01", close: 120, adjClose: 120 },
    { date: "2026-10-16", close: 121, adjClose: 132 },
  ];
  const today = new Date("2026-10-16T12:00:00Z");

  it("räknar i år mot sista stängning föregående år, med justerade kurser", () => {
    expect(periodReturn(pts, "ytd", today)).toBeCloseTo(132 / 110 - 1);
  });

  it("ger null när historiken inte räcker", () => {
    expect(periodReturn(pts, "5y", today)).toBeNull();
  });

  it("tar med sista dagen före perioden som startpunkt i grafen", () => {
    expect(slicePeriod(pts, "ytd", today).map((p) => p.date)).toEqual(["2025-12-31", "2026-06-01", "2026-10-16"]);
  });
});

describe("demodetaljer", () => {
  it("ger fullständiga nyckeltal för aktier och tomma bolagsfält för index", async () => {
    const demo = createDemoProvider();
    const stock = await demo.details("VOLV-B.ST");
    expect(stock.valuation.trailingPE).not.toBeNull();
    expect(stock.ownership.topHolders.length).toBeGreaterThan(0);
    expect(await demo.details("VOLV-B.ST")).toEqual(stock);
    const idx = await demo.details("^OMX");
    expect(idx.valuation.trailingPE).toBeNull();
    expect(idx.trading.fiftyTwoWeekHigh).not.toBeNull();
  });
});
