import type { PricePoint } from "@/lib/market/types";
import { EXTERNAL_FLOW_TYPES, type Transaction } from "./types";

/**
 * Portföljens bokföring som rena funktioner (testas i tests/portfolio.test.ts):
 * genomspelning med GAV, validering, daglig värdering i SEK och tidsviktad avkastning (TWR).
 */

type LedgerTx = Pick<Transaction, "id" | "type" | "tradeDate" | "securityId" | "quantity" | "amountLocal" | "fxRate" | "feesSek" | "cashSek">;

export type Position = {
  securityId: number;
  quantity: number;
  /** Anskaffningsvärde för nuvarande innehav i SEK, inkl. courtage (GAV-metoden) */
  costSek: number;
  /** Anskaffningsvärde i värdepapperets valuta (för GAV i lokal valuta) */
  costLocal: number;
  realizedSek: number;
  dividendsSek: number;
};

export type LedgerState = { cashSek: number; positions: Map<number, Position>; depositsSek: number; withdrawalsSek: number; feesSek: number };

export type LedgerError = { txId: number; date: string; message: string };

const EPS = 1e-9;
const CASH_TOLERANCE = 0.5; // öresavrundning

export function sortTransactions<T extends Pick<Transaction, "tradeDate" | "id">>(txs: T[]): T[] {
  return [...txs].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.id - b.id);
}

function position(state: LedgerState, securityId: number): Position {
  let p = state.positions.get(securityId);
  if (!p) {
    p = { securityId, quantity: 0, costSek: 0, costLocal: 0, realizedSek: 0, dividendsSek: 0 };
    state.positions.set(securityId, p);
  }
  return p;
}

/** Tillämpar en transaktion på tillståndet. Returnerar ett felmeddelande om den inte är tillåten. */
export function applyTransaction(state: LedgerState, tx: LedgerTx): string | null {
  state.cashSek += tx.cashSek;
  switch (tx.type) {
    case "deposit":
      state.depositsSek += tx.cashSek;
      break;
    case "withdrawal":
      state.withdrawalsSek += -tx.cashSek;
      break;
    case "fee":
      state.feesSek += -tx.cashSek;
      break;
    case "buy": {
      const p = position(state, tx.securityId!);
      p.quantity += tx.quantity!;
      p.costSek += -tx.cashSek; // köpbelopp + courtage
      p.costLocal += tx.amountLocal;
      state.feesSek += tx.feesSek;
      break;
    }
    case "sell": {
      const p = position(state, tx.securityId!);
      if (tx.quantity! > p.quantity + EPS) return `Kan inte sälja ${fmt(tx.quantity!)} st, innehavet är ${fmt(p.quantity)} st`;
      const share = p.quantity > 0 ? tx.quantity! / p.quantity : 0;
      const costPart = p.costSek * share;
      p.realizedSek += tx.cashSek - costPart;
      p.costSek -= costPart;
      p.costLocal -= p.costLocal * share;
      p.quantity -= tx.quantity!;
      if (p.quantity < EPS) Object.assign(p, { quantity: 0, costSek: 0, costLocal: 0 });
      state.feesSek += tx.feesSek;
      break;
    }
    case "dividend":
      position(state, tx.securityId!).dividendsSek += tx.cashSek;
      break;
  }
  if (state.cashSek < -CASH_TOLERANCE) return `Likvida medel räcker inte (saldot blir ${fmt(state.cashSek)} kr)`;
  return null;
}

const fmt = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(n);

export function emptyState(): LedgerState {
  return { cashSek: 0, positions: new Map(), depositsSek: 0, withdrawalsSek: 0, feesSek: 0 };
}

/** Spelar upp alla transaktioner i datumordning. Första felet stoppar (används för att validera nya/borttagna). */
export function replay(txs: LedgerTx[]): { state: LedgerState; error: LedgerError | null } {
  const state = emptyState();
  for (const tx of sortTransactions(txs)) {
    const message = applyTransaction(state, tx);
    if (message) return { state, error: { txId: tx.id, date: tx.tradeDate, message } };
  }
  return { state, error: null };
}

// ---------- Daglig värdering och TWR ----------

export type SeriesInput = {
  transactions: LedgerTx[];
  /** Kurshistorik per securityId (stängningskurs i värdepapperets valuta) */
  prices: Map<number, PricePoint[]>;
  /** Valuta per securityId */
  currencies: Map<number, string>;
  /** Valutakurs mot SEK per valuta ('DKK' → DKKSEK=X-historik) */
  fx: Map<string, PricePoint[]>;
  /** Sista dag att värdera (ISO) */
  until: string;
};

export type SeriesPoint = {
  date: string;
  /** Totalt värde i SEK (innehav + kassa) */
  valueSek: number;
  cashSek: number;
  /** Externa flöden denna dag (insättningar − uttag) */
  flowSek: number;
  /** Tidsviktad avkastning som index, 100 vid första dagen med kapital */
  index: number;
};

/** Senaste värde på eller före ett datum, med pekare som bara går framåt (O(n) totalt). */
class ForwardFill {
  private i = -1;
  constructor(private readonly points: PricePoint[]) {}
  at(date: string): number | null {
    while (this.i + 1 < this.points.length && this.points[this.i + 1].date <= date) this.i++;
    return this.i >= 0 ? this.points[this.i].close : null;
  }
}

function* weekdays(from: string, until: string): Generator<string> {
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${until}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) yield new Date(t).toISOString().slice(0, 10);
  }
}

export function valuationSeries(input: SeriesInput): SeriesPoint[] {
  const txs = sortTransactions(input.transactions);
  if (!txs.length) return [];
  const state = emptyState();
  const priceAt = new Map([...input.prices].map(([id, pts]) => [id, new ForwardFill(pts)]));
  const fxAt = new Map([...input.fx].map(([ccy, pts]) => [ccy, new ForwardFill(pts)]));
  const out: SeriesPoint[] = [];
  let k = 0;
  let index = 100;
  let prevValue = 0;

  for (const date of weekdays(txs[0].tradeDate, input.until)) {
    let flow = 0;
    while (k < txs.length && txs[k].tradeDate <= date) {
      const tx = txs[k++];
      applyTransaction(state, tx);
      if (EXTERNAL_FLOW_TYPES.includes(tx.type)) flow += tx.cashSek;
    }
    let holdings = 0;
    for (const p of state.positions.values()) {
      if (p.quantity <= 0) continue;
      const px = priceAt.get(p.securityId)?.at(date);
      const ccy = input.currencies.get(p.securityId) ?? "SEK";
      const fx = ccy === "SEK" ? 1 : fxAt.get(ccy)?.at(date) ?? null;
      // Saknas kurs (t.ex. före första handelsdagen i historiken) används anskaffningsvärdet
      holdings += px != null && fx != null ? p.quantity * px * fx : p.costSek;
    }
    const value = holdings + state.cashSek;
    if (prevValue > 0) {
      const r = (value - flow) / prevValue - 1;
      if (Number.isFinite(r)) index *= 1 + r;
    }
    out.push({ date, valueSek: value, cashSek: state.cashSek, flowSek: flow, index });
    prevValue = value;
  }
  return out;
}

/** Avkastning mellan sista punkten före/på `from` och sista punkten (index-serier) */
export function returnSince(series: { date: string; index: number }[], from: string): number | null {
  if (series.length < 2) return null;
  const start = series.filter((p) => p.date <= from).at(-1) ?? series[0];
  const end = series.at(-1)!;
  return start.index > 0 ? end.index / start.index - 1 : null;
}
