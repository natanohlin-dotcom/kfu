import type { MarketDataProvider } from "@/lib/market/types";
import { normalizeSymbol } from "@/lib/market/types";
import { BASE_CURRENCY, ensureSecurity, fxSymbol } from "@/lib/securities";
import type { TransactionInput } from "./input";
import { replay } from "./ledger";
import { cashEffect, type Transaction, type TransactionType } from "./types";

/** Läsning och skrivning av transaktioner i D1. Validering sker genom att spela upp hela historiken. */

type Row = {
  id: number;
  type: TransactionType;
  trade_date: string;
  security_id: number | null;
  symbol: string | null;
  security_name: string | null;
  quantity: number | null;
  price: number | null;
  currency: string;
  amount_local: number;
  fx_rate: number;
  fees_sek: number;
  cash_sek: number;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

function rowToTransaction(r: Row): Transaction {
  return {
    id: r.id,
    type: r.type,
    tradeDate: r.trade_date,
    securityId: r.security_id,
    symbol: r.symbol,
    securityName: r.security_name,
    quantity: r.quantity,
    price: r.price,
    currency: r.currency,
    amountLocal: r.amount_local,
    fxRate: r.fx_rate,
    feesSek: r.fees_sek,
    cashSek: r.cash_sek,
    note: r.note,
    createdBy: r.created_by_name,
    createdAt: r.created_at,
  };
}

const SELECT = `SELECT t.*, s.symbol, s.name AS security_name, u.display_name AS created_by_name
  FROM transactions t
  LEFT JOIN securities s ON s.id = t.security_id
  LEFT JOIN users u ON u.id = t.created_by`;

export async function listTransactions(db: D1Database): Promise<Transaction[]> {
  const { results } = await db.prepare(`${SELECT} ORDER BY t.trade_date DESC, t.id DESC`).all<Row>();
  return results.map(rowToTransaction);
}

/** Valutakursen mot SEK på (eller närmast före) ett datum, från price_history. */
async function fxOnDate(db: D1Database, currency: string, date: string): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT p.close FROM price_history p JOIN securities s ON s.id = p.security_id
       WHERE s.symbol = ? AND p.date <= ? ORDER BY p.date DESC LIMIT 1`,
    )
    .bind(fxSymbol(currency), date)
    .first<{ close: number }>();
  return row?.close ?? null;
}

export class TransactionError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
  }
}

export async function addTransaction(db: D1Database, market: MarketDataProvider, input: TransactionInput, userId: number): Promise<Transaction> {
  let securityId: number | null = null;
  let currency = BASE_CURRENCY;
  let fxRate = 1;
  let quantity: number | null = null;
  let price: number | null = null;
  let amountLocal: number;
  let feesSek = 0;

  if (input.type === "deposit" || input.type === "withdrawal" || input.type === "fee") {
    amountLocal = input.amount;
  } else {
    const symbol = normalizeSymbol(input.symbol);
    if (!symbol) throw new TransactionError("Ogiltig symbol", "symbol");
    const security = await ensureSecurity(db, market, symbol);
    if (security.kind === "index" || security.kind === "fx") throw new TransactionError("Index och valutor går inte att handla, välj en aktie, ETF eller fond", "symbol");
    securityId = security.id;
    currency = security.currency;
    if (currency !== BASE_CURRENCY) {
      const rate = input.fxRate ?? (await fxOnDate(db, currency, input.tradeDate));
      if (!rate) throw new TransactionError(`Ange valutakurs ${currency}/SEK för affärsdagen`, "fxRate");
      fxRate = rate;
    }
    if (input.type === "dividend") {
      amountLocal = input.amount;
    } else {
      quantity = input.quantity;
      price = input.price;
      amountLocal = input.quantity * input.price;
      feesSek = input.fees;
    }
  }

  const cashSek = cashEffect(input.type, amountLocal, fxRate, feesSek);

  // Validera hela historiken med den nya transaktionen (id 2^31 → sist bland samma dag)
  const existing = await listTransactions(db);
  const candidate = { id: 2 ** 31, type: input.type, tradeDate: input.tradeDate, securityId, quantity, amountLocal, fxRate, feesSek, cashSek };
  const { error } = replay([...existing, candidate]);
  if (error) throw new TransactionError(error.txId === candidate.id ? error.message : `${error.message} (${error.date}) efter den här transaktionen`);

  const row = await db
    .prepare(
      `INSERT INTO transactions (type, trade_date, security_id, quantity, price, currency, amount_local, fx_rate, fees_sek, cash_sek, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(input.type, input.tradeDate, securityId, quantity, price, currency, amountLocal, fxRate, feesSek, cashSek, input.note || null, userId, new Date().toISOString())
    .first<{ id: number }>();
  const created = await db.prepare(`${SELECT} WHERE t.id = ?`).bind(row!.id).first<Row>();
  return rowToTransaction(created!);
}

export async function deleteTransaction(db: D1Database, id: number): Promise<void> {
  const existing = await listTransactions(db);
  if (!existing.some((t) => t.id === id)) throw new TransactionError("Transaktionen finns inte");
  const { error } = replay(existing.filter((t) => t.id !== id));
  if (error) throw new TransactionError(`Kan inte tas bort: ${error.message.toLowerCase()} (${error.date})`);
  await db.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
}
