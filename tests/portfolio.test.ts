import { describe, expect, it } from "vitest";
import { replay, returnSince, valuationSeries } from "@/lib/portfolio/ledger";
import { cashEffect, type TransactionType } from "@/lib/portfolio/types";

let nextId = 1;
function tx(type: TransactionType, tradeDate: string, o: { sec?: number; q?: number; price?: number; amount?: number; fx?: number; fees?: number } = {}) {
  const amountLocal = o.amount ?? (o.q ?? 0) * (o.price ?? 0);
  const fxRate = o.fx ?? 1;
  const feesSek = o.fees ?? 0;
  return { id: nextId++, type, tradeDate, securityId: o.sec ?? null, quantity: o.q ?? null, amountLocal, fxRate, feesSek, cashSek: cashEffect(type, amountLocal, fxRate, feesSek) };
}

describe("kassapåverkan", () => {
  it("har rätt tecken och räknar courtage", () => {
    expect(cashEffect("deposit", 1000, 1, 0)).toBe(1000);
    expect(cashEffect("buy", 1000, 1.5, 10)).toBe(-1510);
    expect(cashEffect("sell", 1000, 1.5, 10)).toBe(1490);
    expect(cashEffect("withdrawal", 200, 1, 0)).toBe(-200);
    expect(cashEffect("dividend", 50, 1.5, 0)).toBe(75);
  });
});

describe("genomspelning med GAV", () => {
  it("räknar innehav, anskaffningsvärde, realiserat resultat och kassa", () => {
    const { state, error } = replay([
      tx("deposit", "2026-01-02", { amount: 10_000 }),
      tx("buy", "2026-01-05", { sec: 1, q: 10, price: 100, fees: 10 }), // kostnad 1 010
      tx("buy", "2026-02-05", { sec: 1, q: 10, price: 200, fees: 10 }), // kostnad 2 010 → GAV 151
      tx("sell", "2026-03-05", { sec: 1, q: 5, price: 300, fees: 10 }), // intäkt 1 490, kostnad 755
      tx("dividend", "2026-04-01", { sec: 1, amount: 75 }),
    ]);
    expect(error).toBeNull();
    const p = state.positions.get(1)!;
    expect(p.quantity).toBe(15);
    expect(p.costSek).toBeCloseTo(3020 * 0.75);
    expect(p.realizedSek).toBeCloseTo(1490 - 755);
    expect(p.dividendsSek).toBe(75);
    expect(state.cashSek).toBeCloseTo(10_000 - 1010 - 2010 + 1490 + 75);
  });

  it("stoppar försäljning av mer än innehavet", () => {
    const { error } = replay([tx("deposit", "2026-01-02", { amount: 1000 }), tx("buy", "2026-01-03", { sec: 1, q: 5, price: 10 }), tx("sell", "2026-01-04", { sec: 1, q: 6, price: 10 })]);
    expect(error?.message).toMatch(/Kan inte sälja 6 st, innehavet är 5 st/);
  });

  it("stoppar köp som gör kassan negativ, även om insättningen kommer senare", () => {
    const { error } = replay([tx("buy", "2026-01-02", { sec: 1, q: 1, price: 100 }), tx("deposit", "2026-01-03", { amount: 1000 })]);
    expect(error?.message).toMatch(/Likvida medel räcker inte/);
    expect(error?.date).toBe("2026-01-02");
  });
});

describe("värdering och tidsviktad avkastning", () => {
  const prices = new Map([[1, [
    { date: "2026-01-05", close: 100, adjClose: 100 },
    { date: "2026-01-06", close: 110, adjClose: 110 },
    { date: "2026-01-07", close: 110, adjClose: 110 },
    { date: "2026-01-08", close: 121, adjClose: 121 },
  ]]]);

  it("påverkas inte av insättningar (TWR), bara av kursutveckling", () => {
    const series = valuationSeries({
      transactions: [
        tx("deposit", "2026-01-05", { amount: 1000 }),
        tx("buy", "2026-01-05", { sec: 1, q: 10, price: 100 }),
        tx("deposit", "2026-01-07", { amount: 5000 }), // stor insättning mitt i
      ],
      prices, currencies: new Map([[1, "SEK"]]), fx: new Map(), until: "2026-01-08",
    });
    expect(series.map((p) => p.date)).toEqual(["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"]);
    expect(series[0].index).toBe(100);
    expect(series[1].index).toBeCloseTo(110); // +10 %
    expect(series[2].index).toBeCloseTo(110); // insättningen ger ingen avkastning
    expect(series[2].valueSek).toBeCloseTo(6100);
    // dag 4: 1 210 i aktien + 5 000 kassa = 6 210, avkastning 110/6100
    expect(series[3].index).toBeCloseTo(110 * (6210 / 6100));
  });

  it("räknar om utländska innehav till SEK med dagens valutakurs och hoppar över helger", () => {
    const series = valuationSeries({
      transactions: [tx("deposit", "2026-01-09", { amount: 2000 }), tx("buy", "2026-01-09", { sec: 2, q: 10, price: 100, fx: 1.5 })],
      prices: new Map([[2, [{ date: "2026-01-09", close: 100, adjClose: 100 }, { date: "2026-01-12", close: 100, adjClose: 100 }]]]),
      currencies: new Map([[2, "DKK"]]),
      fx: new Map([["DKK", [{ date: "2026-01-09", close: 1.5, adjClose: 1.5 }, { date: "2026-01-12", close: 1.65, adjClose: 1.65 }]]]),
      until: "2026-01-12",
    });
    expect(series.map((p) => p.date)).toEqual(["2026-01-09", "2026-01-12"]);
    expect(series[1].valueSek).toBeCloseTo(10 * 100 * 1.65 + 500);
    expect(series[1].index).toBeCloseTo(100 * (2150 / 2000));
  });

  it("räknar avkastning sedan ett datum", () => {
    const s = [{ date: "2025-12-31", index: 100 }, { date: "2026-06-01", index: 105 }, { date: "2026-10-16", index: 110 }];
    expect(returnSince(s, "2025-12-31")).toBeCloseTo(0.1);
    expect(returnSince(s, "2026-06-01")).toBeCloseTo(110 / 105 - 1);
  });
});
