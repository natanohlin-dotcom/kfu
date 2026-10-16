import type { MarketDataProvider } from "@/lib/market/types";
import type { WatchItem } from "./repo";
import { targetDistance } from "./status";

/** Bevakning med aktuell kurs (för lista, tavla och widget). */
export type WatchRow = WatchItem & { price: number | null; changePercent: number | null; distance: number | null };

export async function withQuotes(items: WatchItem[], market: MarketDataProvider): Promise<WatchRow[]> {
  const quotes = items.length ? await market.quotes(items.map((i) => i.security.symbol)).catch(() => []) : [];
  return items.map((i) => {
    const q = quotes.find((x) => x.symbol === i.security.symbol);
    return { ...i, price: q?.price ?? null, changePercent: q?.changePercent ?? null, distance: targetDistance(q?.price, i.targetPrice) };
  });
}
