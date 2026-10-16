/** Transaktionstyper och etiketter (tabell transactions, PLAN.md §6). */

export const TRANSACTION_TYPES = ["deposit", "withdrawal", "buy", "sell", "dividend", "fee"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TYPE_LABELS: Record<TransactionType, string> = {
  deposit: "Insättning",
  withdrawal: "Uttag",
  buy: "Köp",
  sell: "Sälj",
  dividend: "Utdelning",
  fee: "Avgift",
};

/** Typer som gäller ett värdepapper */
export const SECURITY_TYPES: TransactionType[] = ["buy", "sell", "dividend"];
/** Externa flöden: påverkar kapitalet men inte avkastningen (TWR) */
export const EXTERNAL_FLOW_TYPES: TransactionType[] = ["deposit", "withdrawal"];

export type Transaction = {
  id: number;
  type: TransactionType;
  tradeDate: string;
  securityId: number | null;
  symbol: string | null;
  securityName: string | null;
  quantity: number | null;
  price: number | null;
  currency: string;
  amountLocal: number;
  fxRate: number;
  feesSek: number;
  cashSek: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** Kassapåverkan i SEK med tecken (räknas alltid på servern). */
export function cashEffect(type: TransactionType, amountLocal: number, fxRate: number, feesSek: number): number {
  const gross = amountLocal * fxRate;
  switch (type) {
    case "deposit":
    case "dividend":
      return gross - feesSek;
    case "sell":
      return gross - feesSek;
    case "buy":
      return -gross - feesSek;
    case "withdrawal":
    case "fee":
      return -gross - feesSek;
  }
}
