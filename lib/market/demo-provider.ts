import {
  MarketDataError,
  type HistoryRange,
  type MarketDataProvider,
  type PriceHistory,
  type CompanyDetails,
  type PricePoint,
  type SecurityKind,
  type SecurityProfile,
} from "./types";

/**
 * Demoleverantör för lokal utveckling när Yahoo inte nås (t.ex. 429 från universitetsnätet).
 * Slås på med MARKET_PROVIDER=demo. Kurserna är påhittade men deterministiska (samma symbol ger
 * samma serie), och gränssnittet visar "Demodata" så att de aldrig förväxlas med riktiga.
 */

type DemoSecurity = { symbol: string; name: string; kind: SecurityKind; currency: string; exchange: string; start: number; vol: number; country?: string; sector?: string };

const CATALOG: DemoSecurity[] = [
  { symbol: "^OMX", name: "OMX Stockholm 30 Index", kind: "index", currency: "SEK", exchange: "Stockholm", start: 1600, vol: 0.16 },
  { symbol: "^OMXSPI", name: "OMX Stockholm All-Share Index", kind: "index", currency: "SEK", exchange: "Stockholm", start: 560, vol: 0.15 },
  { symbol: "^GSPC", name: "S&P 500", kind: "index", currency: "USD", exchange: "SNP", start: 2100, vol: 0.17 },
  { symbol: "XACT-OMXS30.ST", name: "XACT OMXS30 (UCITS ETF)", kind: "etf", currency: "SEK", exchange: "Stockholm", start: 160, vol: 0.16 },
  { symbol: "NOVO-B.CO", name: "Novo Nordisk A/S", kind: "stock", currency: "DKK", exchange: "Copenhagen", start: 160, vol: 0.3, country: "Denmark", sector: "Healthcare" },
  { symbol: "VOLV-B.ST", name: "AB Volvo (publ)", kind: "stock", currency: "SEK", exchange: "Stockholm", start: 140, vol: 0.27, country: "Sweden", sector: "Industrials" },
  { symbol: "ATCO-A.ST", name: "Atlas Copco AB", kind: "stock", currency: "SEK", exchange: "Stockholm", start: 60, vol: 0.26, country: "Sweden", sector: "Industrials" },
  { symbol: "INVE-B.ST", name: "Investor AB (publ)", kind: "stock", currency: "SEK", exchange: "Stockholm", start: 90, vol: 0.2, country: "Sweden", sector: "Financial Services" },
  { symbol: "ERIC-B.ST", name: "Telefonaktiebolaget LM Ericsson", kind: "stock", currency: "SEK", exchange: "Stockholm", start: 80, vol: 0.32, country: "Sweden", sector: "Technology" },
  { symbol: "AAPL", name: "Apple Inc.", kind: "stock", currency: "USD", exchange: "NasdaqGS", start: 30, vol: 0.28, country: "United States", sector: "Technology" },
  { symbol: "USDSEK=X", name: "USD/SEK", kind: "fx", currency: "SEK", exchange: "CCY", start: 8.6, vol: 0.08 },
  { symbol: "DKKSEK=X", name: "DKK/SEK", kind: "fx", currency: "SEK", exchange: "CCY", start: 1.3, vol: 0.05 },
  { symbol: "EURSEK=X", name: "EUR/SEK", kind: "fx", currency: "SEK", exchange: "CCY", start: 9.5, vol: 0.06 },
];

function seedOf(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** mulberry32 + Box–Muller: samma frö ger samma slumpserie */
function normalRandom(seed: number): () => number {
  let a = seed;
  const uniform = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform());
}

/** Likformigt slumptal i [0, 1) per symbol och fält – stabila demovärden */
function demoNumber(symbol: string, field: string, min: number, max: number, digits = 2): number {
  const u = ((seedOf(`${symbol}:${field}`) % 100_000) / 100_000);
  const v = min + u * (max - min);
  return Math.round(v * 10 ** digits) / 10 ** digits;
}

const DAY = 86_400_000;

/** Analytikerdata som hänger ihop: fördelningen summerar till antalet, rekommendationen följer majoriteten. */
function demoAnalysts(symbol: string, last: number, revenue: number | null, eps: number | null, shares: number | null): CompanyDetails["analysts"] {
  const n = (field: string, min: number, max: number, digits = 2) => demoNumber(symbol, field, min, max, digits);
  const total = n("cnt", 6, 26, 0);
  const trend = [0, 1, 2, 3].map((m) => {
    const bullish = n(`bull${m}`, 0.25, 0.75);
    const bearish = n(`bear${m}`, 0.0, 0.25);
    const strongBuy = Math.round(total * bullish * 0.4);
    const buy = Math.round(total * bullish) - strongBuy;
    const sell = Math.round(total * bearish);
    const strongSell = sell > 2 ? 1 : 0;
    const hold = Math.max(0, total - strongBuy - buy - sell);
    return { monthsAgo: m, strongBuy, buy, hold, sell: sell - strongSell, strongSell };
  });
  const now = trend[0];
  const score = (now.strongBuy * 1 + now.buy * 2 + now.hold * 3 + now.sell * 4 + now.strongSell * 5) / total;
  const recommendation = score < 1.8 ? "strong_buy" : score < 2.5 ? "buy" : score < 3.5 ? "hold" : score < 4.2 ? "underperform" : "sell";
  const year = new Date().getUTCFullYear();
  const est = (kind: "quarter" | "year", offset: 0 | 1, endDate: string, scale: number) => {
    const g = n(`g${kind}${offset}`, -0.05, 0.18, 3);
    const epsAvg = eps ? Math.round(eps * scale * (1 + g) * 100) / 100 : null;
    const revAvg = revenue ? Math.round(revenue * scale * (1 + g * 0.6)) : null;
    return {
      kind, offset, endDate,
      eps: { avg: epsAvg, low: epsAvg && Math.round(epsAvg * 0.88 * 100) / 100, high: epsAvg && Math.round(epsAvg * 1.12 * 100) / 100, yearAgo: eps ? Math.round(eps * scale * 100) / 100 : null, analysts: Math.max(3, total - n(`a${kind}${offset}`, 0, 5, 0)), growth: g },
      revenue: { avg: revAvg, low: revAvg && Math.round(revAvg * 0.95), high: revAvg && Math.round(revAvg * 1.05), yearAgo: revenue ? Math.round(revenue * scale) : null, analysts: Math.max(3, total - n(`r${kind}${offset}`, 1, 6, 0)), growth: Math.round(g * 0.6 * 1000) / 1000 },
    };
  };
  return {
    targetMean: Math.round(last * n("tgt", 0.9, 1.3) * 100) / 100,
    targetHigh: Math.round(last * n("tgth", 1.3, 1.7) * 100) / 100,
    targetLow: Math.round(last * n("tgtl", 0.6, 0.9) * 100) / 100,
    recommendation,
    count: total,
    recommendationTrend: trend,
    estimates: shares
      ? [est("quarter", 0, `${year}-12-31`, 0.25), est("quarter", 1, `${year + 1}-03-31`, 0.25), est("year", 0, `${year}-12-31`, 1), est("year", 1, `${year + 1}-12-31`, 1)]
      : [],
  };
}
const START = Date.UTC(2015, 0, 1);

/** Hela serien från 2015 till idag (vardagar), geometrisk slumpvandring med svag uppåtdrift. */
export function demoSeries(sec: DemoSecurity, today = new Date()): PricePoint[] {
  const rand = normalRandom(seedOf(sec.symbol));
  const dt = 1 / 252;
  const drift = sec.kind === "fx" ? 0 : 0.07;
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const points: PricePoint[] = [];
  let price = sec.start;
  for (let t = START; t <= end; t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    price *= Math.exp((drift - (sec.vol * sec.vol) / 2) * dt + sec.vol * Math.sqrt(dt) * rand());
    const close = Math.round(price * 100) / 100;
    points.push({ date: new Date(t).toISOString().slice(0, 10), close, adjClose: close });
  }
  return points;
}

const RANGE_DAYS: Record<HistoryRange, number> = { "5d": 7, "1mo": 31, "3mo": 92, "6mo": 183, ytd: 366, "1y": 366, "2y": 731, "5y": 1827, "10y": 3653, max: 100_000 };

function find(symbol: string): DemoSecurity {
  const s = CATALOG.find((c) => c.symbol === symbol);
  if (!s) throw new MarketDataError(`Okänd symbol i demodata: ${symbol}`, 404);
  return s;
}

export function createDemoProvider(): MarketDataProvider {
  return {
    async search(query) {
      const q = query.trim().toLowerCase();
      return CATALOG.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(({ symbol, name, kind, exchange }) => ({ symbol, name, kind, exchange }));
    },

    async quotes(symbols) {
      return symbols.flatMap((symbol) => {
        const sec = CATALOG.find((c) => c.symbol === symbol);
        if (!sec) return [];
        const pts = demoSeries(sec);
        const last = pts.at(-1)!;
        const prev = pts.at(-2)?.close ?? null;
        const year = pts.slice(-252).map((p) => p.close);
        return [{
          symbol, name: sec.name, currency: sec.currency, price: last.close, previousClose: prev,
          changePercent: prev ? last.close / prev - 1 : null, marketCap: null,
          fiftyTwoWeekHigh: Math.max(...year), fiftyTwoWeekLow: Math.min(...year),
          marketTime: `${last.date}T15:30:00.000Z`,
        }];
      });
    },

    async history(symbol, range): Promise<PriceHistory> {
      const sec = find(symbol);
      const from = new Date(Date.now() - RANGE_DAYS[range] * DAY).toISOString().slice(0, 10);
      const fromYtd = `${new Date().getUTCFullYear()}-01-01`;
      const cutoff = range === "ytd" ? fromYtd : from;
      return { symbol, currency: sec.currency, points: demoSeries(sec).filter((p) => p.date >= cutoff) };
    },

    async details(symbol): Promise<CompanyDetails> {
      const sec = find(symbol);
      const pts = demoSeries(sec);
      const last = pts.at(-1)!.close;
      const year = pts.slice(-252).map((p) => p.close);
      const n = (field: string, min: number, max: number, digits = 2) => demoNumber(symbol, field, min, max, digits);
      const stock = sec.kind === "stock";
      const shares = stock ? n("shares", 0.3e9, 4e9, 0) : null;
      const pe = stock ? n("pe", 8, 35, 1) : null;
      const revenue = stock && shares ? Math.round((last * shares) / n("ps", 1, 6)) : null;
      const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
      const empty = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.keys(o).map((k) => [k, null])) as T;

      const details: CompanyDetails = {
        symbol, currency: sec.currency, financialCurrency: null,
        valuation: {
          marketCap: shares ? Math.round(last * shares) : null,
          enterpriseValue: shares ? Math.round(last * shares * n("ev", 1.0, 1.3)) : null,
          trailingPE: pe, forwardPE: pe ? Math.round(pe * n("fpe", 0.8, 1.05) * 10) / 10 : null,
          priceToSales: stock ? n("ps", 1, 6) : null, priceToBook: stock ? n("pb", 1, 9) : null,
          evToEbitda: stock ? n("evebitda", 5, 22, 1) : null, evToRevenue: stock ? n("evrev", 1, 7) : null, pegRatio: stock ? n("peg", 0.6, 3) : null,
        },
        perShare: {
          trailingEps: pe ? Math.round((last / pe) * 100) / 100 : null, forwardEps: pe ? Math.round((last / pe) * 1.08 * 100) / 100 : null,
          bookValue: stock ? Math.round((last / n("pb", 1, 9)) * 100) / 100 : null, sharesOutstanding: shares, impliedSharesOutstanding: shares,
        },
        trading: {
          open: pts.at(-2)?.close ?? null, dayHigh: Math.round(last * 1.012 * 100) / 100, dayLow: Math.round(last * 0.988 * 100) / 100,
          previousClose: pts.at(-2)?.close ?? null, volume: sec.kind === "fx" ? null : n("vol", 2e5, 6e6, 0), averageVolume: sec.kind === "fx" ? null : n("avgvol", 3e5, 5e6, 0),
          fiftyTwoWeekHigh: Math.max(...year), fiftyTwoWeekLow: Math.min(...year), beta: stock ? n("beta", 0.5, 1.6) : null,
        },
        profitability: stock
          ? { totalRevenue: revenue, revenueGrowth: n("revg", -0.08, 0.18, 3), earningsGrowth: n("epsg", -0.15, 0.3, 3), grossMargin: n("gm", 0.2, 0.85, 3), operatingMargin: n("om", 0.05, 0.45, 3), ebitdaMargin: n("em", 0.1, 0.5, 3), profitMargin: n("pm", 0.03, 0.35, 3), returnOnEquity: n("roe", 0.05, 0.6, 3), returnOnAssets: n("roa", 0.02, 0.2, 3) }
          : empty({ totalRevenue: 0, revenueGrowth: 0, earningsGrowth: 0, grossMargin: 0, operatingMargin: 0, ebitdaMargin: 0, profitMargin: 0, returnOnEquity: 0, returnOnAssets: 0 }),
        financialHealth: stock && revenue
          ? { totalCash: Math.round(revenue * n("cash", 0.05, 0.3)), totalDebt: Math.round(revenue * n("debt", 0.1, 0.8)), debtToEquity: n("de", 0.1, 1.5), currentRatio: n("cr", 0.8, 2.5), quickRatio: n("qr", 0.5, 1.8), freeCashflow: Math.round(revenue * n("fcf", 0.02, 0.25)), operatingCashflow: Math.round(revenue * n("ocf", 0.08, 0.35)) }
          : empty({ totalCash: 0, totalDebt: 0, debtToEquity: 0, currentRatio: 0, quickRatio: 0, freeCashflow: 0, operatingCashflow: 0 }),
        dividend: stock
          ? { rate: Math.round(last * n("dy", 0.005, 0.05, 4) * 100) / 100, yield: n("dy", 0.005, 0.05, 4), payoutRatio: n("payout", 0.2, 0.8, 3), fiveYearAvgYield: n("dy5", 0.01, 0.045, 4), exDate: isoIn(-n("exd", 20, 160, 0)), payDate: isoIn(-n("exd", 20, 160, 0) + 5) }
          : empty({ rate: 0, yield: 0, payoutRatio: 0, fiveYearAvgYield: 0, exDate: "", payDate: "" }),
        analysts: stock ? demoAnalysts(symbol, last, revenue, pe ? last / pe : null, shares) : {
          targetMean: null, targetHigh: null, targetLow: null, recommendation: null, count: null, recommendationTrend: [], estimates: [],
        },
        calendar: { nextEarnings: stock ? isoIn(n("earn", 5, 80, 0)) : null },
        ownership: stock
          ? {
              insidersPercent: n("ins", 0.001, 0.25, 4), institutionsPercent: n("inst", 0.2, 0.75, 4),
              topHolders: Array.from({ length: 6 }, (_, i) => ({ name: `Demoägare ${i + 1}`, percent: Math.round(n(`h${i}`, 0.01, 0.12, 4) * (6 - i) / 6 * 10000) / 10000, shares: shares ? Math.round(shares * n(`h${i}`, 0.01, 0.12, 4) * (6 - i) / 6) : null, reportDate: isoIn(-40) })).sort((x, y) => (y.percent ?? 0) - (x.percent ?? 0)),
            }
          : { insidersPercent: null, institutionsPercent: null, topHolders: [] },
        profile: stock
          ? { description: `${sec.name} är ett bolag i demodatan. Beskrivningen hämtas från Yahoo när riktig marknadsdata används.`, sector: sec.sector ?? null, industry: null, employees: n("emp", 2000, 100000, 0), website: null, city: null, country: sec.country ?? null, ceo: null }
          : { description: null, sector: null, industry: null, employees: null, website: null, city: null, country: null, ceo: null },
      };
      return details;
    },

    async profile(symbol): Promise<SecurityProfile> {
      const s = find(symbol);
      return { symbol: s.symbol, name: s.name, kind: s.kind, currency: s.currency, exchange: s.exchange, country: s.country ?? null, sector: s.sector ?? null, financialCurrency: null };
    },
  };
}
