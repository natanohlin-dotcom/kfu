import { listBenchmarks, type Benchmark } from "@/lib/benchmarks";
import type { MarketDataProvider, PricePoint, SecurityKind } from "@/lib/market/types";
import { BASE_CURRENCY, fxSymbol } from "@/lib/securities";
import { replay, returnSince, valuationSeries, type SeriesPoint } from "./ledger";
import { listTransactions } from "./repo";

/**
 * Allt som översikten och innehavssidan behöver, i ett anrop: innehav med marknadsvärde i SEK,
 * kassa, nyckeltal, TWR-serie och jämförelseindex. Räknas vid varje sidvisning (snabbt för
 * utskottets storlek; vid behov kan serien senare sparas dagligen av cron).
 */

export type Holding = {
  securityId: number;
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  sector: string | null;
  quantity: number;
  /** Genomsnittligt anskaffningsvärde per aktie i lokal valuta respektive SEK (inkl. courtage) */
  gavLocal: number;
  gavSek: number;
  price: number | null;
  changePercent: number | null;
  fxRate: number;
  valueSek: number;
  costSek: number;
  unrealizedSek: number;
  unrealizedPct: number | null;
  weight: number;
  realizedSek: number;
  dividendsSek: number;
};

export type ChartSeries = { id: string; label: string; color: string; points: { date: string; value: number }[] };

export type PortfolioOverview = {
  hasTransactions: boolean;
  firstDate: string | null;
  cashSek: number;
  holdingsSek: number;
  totalSek: number;
  costSek: number;
  unrealizedSek: number;
  realizedSek: number;
  dividendsSek: number;
  depositsSek: number;
  withdrawalsSek: number;
  feesSek: number;
  holdings: Holding[];
  /** TWR i år och sedan start */
  ytd: number | null;
  sinceStart: number | null;
  benchmarks: Benchmark[];
  mainBenchmark: (Benchmark & { ytdSameSpan: number | null }) | null;
  /** Serier för grafen: portföljen (TWR-index) först, sedan jämförelseindex (justerade kurser) */
  chart: ChartSeries[];
};

type PriceRow = { security_id: number; date: string; close: number; adj_close: number };

async function priceRows(db: D1Database, ids: number[], since: string): Promise<Map<number, PricePoint[]>> {
  const out = new Map<number, PricePoint[]>();
  if (!ids.length) return out;
  const { results } = await db
    .prepare(`SELECT security_id, date, close, adj_close FROM price_history WHERE security_id IN (${ids.map(() => "?").join(",")}) AND date >= ? ORDER BY security_id, date`)
    .bind(...ids, since)
    .all<PriceRow>();
  for (const r of results) {
    let list = out.get(r.security_id);
    if (!list) out.set(r.security_id, (list = []));
    list.push({ date: r.date, close: r.close, adjClose: r.adj_close });
  }
  return out;
}

const daysBefore = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

export async function loadPortfolio(db: D1Database, market: MarketDataProvider, today = new Date()): Promise<PortfolioOverview> {
  const todayIso = today.toISOString().slice(0, 10);
  const yearStart = `${today.getUTCFullYear() - 1}-12-31`;
  const [transactions, benchmarks] = await Promise.all([listTransactions(db), listBenchmarks(db, today)]);
  const firstDate = transactions.length ? transactions.map((t) => t.tradeDate).sort()[0] : null;
  const since = daysBefore(firstDate ?? daysBefore(todayIso, 3 * 365), 10);

  // Värdepapper som någon gång ägts, och deras valutor
  const secIds = [...new Set(transactions.flatMap((t) => (t.securityId ? [t.securityId] : [])))];
  const { results: secRows } = secIds.length
    ? await db
        .prepare(`SELECT id, symbol, name, kind, currency, sector FROM securities WHERE id IN (${secIds.map(() => "?").join(",")})`)
        .bind(...secIds)
        .all<{ id: number; symbol: string; name: string; kind: SecurityKind; currency: string; sector: string | null }>()
    : { results: [] };
  const secById = new Map(secRows.map((s) => [s.id, s]));
  const currencies = [...new Set(secRows.map((s) => s.currency).filter((c) => c !== BASE_CURRENCY))];
  const { results: fxRows } = currencies.length
    ? await db
        .prepare(`SELECT id, symbol FROM securities WHERE symbol IN (${currencies.map(() => "?").join(",")})`)
        .bind(...currencies.map(fxSymbol))
        .all<{ id: number; symbol: string }>()
    : { results: [] };

  const prices = await priceRows(db, [...secIds, ...fxRows.map((f) => f.id), ...benchmarks.map((b) => b.security.id)], since);
  const fx = new Map(currencies.map((c) => [c, prices.get(fxRows.find((f) => f.symbol === fxSymbol(c))?.id ?? -1) ?? []]));

  // Genomspelning och TWR
  const { state } = replay(transactions);
  const series: SeriesPoint[] = valuationSeries({
    transactions,
    prices: new Map(secIds.map((id) => [id, prices.get(id) ?? []])),
    currencies: new Map(secRows.map((s) => [s.id, s.currency])),
    fx,
    until: todayIso,
  });

  // Innehav värderade med aktuell kurs (cachad 15 min), annars senaste stängning
  const open = [...state.positions.values()].filter((p) => p.quantity > 0);
  const quotes = await market.quotes(open.map((p) => secById.get(p.securityId)!.symbol)).catch(() => []);
  const holdings: Holding[] = open.map((p) => {
    const s = secById.get(p.securityId)!;
    const q = quotes.find((x) => x.symbol === s.symbol);
    const price = q?.price ?? prices.get(s.id)?.at(-1)?.close ?? null;
    const fxRate = s.currency === BASE_CURRENCY ? 1 : fx.get(s.currency)?.at(-1)?.close ?? 1;
    const valueSek = price != null ? p.quantity * price * fxRate : p.costSek;
    const unrealizedSek = valueSek - p.costSek;
    return {
      securityId: s.id, symbol: s.symbol, name: s.name, kind: s.kind, currency: s.currency, sector: s.sector,
      quantity: p.quantity, gavLocal: p.costLocal / p.quantity, gavSek: p.costSek / p.quantity,
      price, changePercent: q?.changePercent ?? null, fxRate, valueSek, costSek: p.costSek,
      unrealizedSek, unrealizedPct: p.costSek > 0 ? unrealizedSek / p.costSek : null, weight: 0,
      realizedSek: p.realizedSek, dividendsSek: p.dividendsSek,
    };
  });
  const holdingsSek = holdings.reduce((sum, h) => sum + h.valueSek, 0);
  const totalSek = holdingsSek + state.cashSek;
  for (const h of holdings) h.weight = totalSek > 0 ? h.valueSek / totalSek : 0;
  holdings.sort((a, b) => b.valueSek - a.valueSek);
  const all = [...state.positions.values()];

  // Jämförelse: standardindex över samma tidsspann som portföljens "i år"
  const main = benchmarks.find((b) => b.isDefault) ?? benchmarks[0] ?? null;
  const portfolioStart = series[0]?.date ?? null;
  const benchFrom = portfolioStart && portfolioStart > yearStart ? portfolioStart : yearStart;
  const mainPoints = main ? prices.get(main.security.id) ?? [] : [];
  const mainYtd = returnSince(mainPoints.map((p) => ({ date: p.date, index: p.adjClose })), benchFrom);

  const chart: ChartSeries[] = [];
  if (series.length) chart.push({ id: "portfolio", label: "Portföljen", color: "series-1", points: series.map((p) => ({ date: p.date, value: p.index })) });
  for (const b of benchmarks) {
    chart.push({ id: `b${b.id}`, label: b.label, color: b.color, points: (prices.get(b.security.id) ?? []).map((p) => ({ date: p.date, value: p.adjClose })) });
  }

  return {
    hasTransactions: transactions.length > 0,
    firstDate,
    cashSek: state.cashSek,
    holdingsSek,
    totalSek,
    costSek: holdings.reduce((s, h) => s + h.costSek, 0),
    unrealizedSek: holdings.reduce((s, h) => s + h.unrealizedSek, 0),
    realizedSek: all.reduce((s, p) => s + p.realizedSek, 0),
    dividendsSek: all.reduce((s, p) => s + p.dividendsSek, 0),
    depositsSek: state.depositsSek,
    withdrawalsSek: state.withdrawalsSek,
    feesSek: state.feesSek,
    holdings,
    ytd: returnSince(series, yearStart),
    sinceStart: series.length ? series.at(-1)!.index / 100 - 1 : null,
    benchmarks,
    mainBenchmark: main ? { ...main, ytdSameSpan: mainYtd } : null,
    chart,
  };
}
