import { describe, expect, it } from "vitest";
import { createDemoProvider } from "@/lib/market/demo-provider";
import { rangeSince } from "@/lib/market/prices";
import { normalizeSymbol } from "@/lib/market/types";
import { kindFromYahoo, normalizeChart, normalizeQuote, normalizeSearch, quoteFromChartMeta } from "@/lib/market/yahoo-provider";
import type { ChartResponse } from "@/lib/market/yahoo";
import { BENCHMARK_COLORS, isBenchmarkColor, nextColor } from "@/lib/benchmarks";

// Tidsstämplar som Yahoo skickar dem: öppning 09:00 Stockholm (07:00 UTC sommartid), gmtoffset 7200
const t = (iso: string) => Date.parse(iso) / 1000;
const chart: ChartResponse = {
  chart: {
    error: null,
    result: [
      {
        meta: { symbol: "^omx", currency: "SEK", exchangeName: "STO", regularMarketPrice: 3256.08, chartPreviousClose: 3200, gmtoffset: 7200, fiftyTwoWeekHigh: 3300, fiftyTwoWeekLow: 2500, regularMarketTime: t("2026-10-15T15:30:00Z"), instrumentType: "INDEX", longName: "OMX Stockholm 30 Index" },
        timestamp: [t("2026-10-13T07:00:00Z"), t("2026-10-14T07:00:00Z"), t("2026-10-14T15:30:00Z"), t("2026-10-15T07:00:00Z"), t("2026-10-15T22:30:00Z")],
        indicators: { quote: [{ close: [3100, 3150, 3160, null, 3256.08] }], adjclose: [{ adjclose: [3099, 3149, 3159, null, 3256.08] }] },
      },
    ],
  },
};

describe("Yahoo-normalisering", () => {
  it("gör om tidsstämplar till handelsdagar i börsens tidszon, sista värdet per dag vinner", () => {
    const h = normalizeChart(chart);
    expect(h.symbol).toBe("^OMX");
    // 2026-10-15T22:30Z är 00:30 den 16:e i Stockholm
    expect(h.points).toEqual([
      { date: "2026-10-13", close: 3100, adjClose: 3099 },
      { date: "2026-10-14", close: 3160, adjClose: 3159 },
      { date: "2026-10-16", close: 3256.08, adjClose: 3256.08 },
    ]);
  });

  it("kastar 404 när Yahoo inte har data", () => {
    expect(() => normalizeChart({ chart: { result: null, error: { code: "Not Found" } } })).toThrow(/Ingen kursdata/);
  });

  it("räknar dagsförändring från chart-metadata", () => {
    const q = quoteFromChartMeta(chart.chart.result![0].meta);
    expect(q.changePercent).toBeCloseTo(3256.08 / 3200 - 1);
    expect(q.name).toBe("OMX Stockholm 30 Index");
    expect(q.marketTime).toBe("2026-10-15T15:30:00.000Z");
  });

  it("gör om quote-procent till andel och hoppar över kurser som saknas", () => {
    expect(normalizeQuote({ symbol: "volv-b.st", regularMarketPrice: 319.7, regularMarketChangePercent: -1.5 })?.changePercent).toBeCloseTo(-0.015);
    expect(normalizeQuote({ symbol: "X" })).toBeNull();
  });

  it("filtrerar sökträffar till typer vi stödjer", () => {
    const hits = normalizeSearch({
      quotes: [
        { symbol: "NOVO-B.CO", longname: "Novo Nordisk A/S", exchDisp: "Copenhagen", quoteType: "EQUITY" },
        { symbol: "NVO250117C00100000", quoteType: "OPTION" },
        { symbol: "^OMX", shortname: "OMXS30", quoteType: "INDEX" },
      ],
    });
    expect(hits.map((h) => [h.symbol, h.kind])).toEqual([["NOVO-B.CO", "stock"], ["^OMX", "index"]]);
    expect(kindFromYahoo("CRYPTOCURRENCY")).toBe("other");
  });
});

describe("kurssynk och symboler", () => {
  it("väljer minsta intervall som täcker tiden sedan senaste kurs", () => {
    const today = new Date("2026-10-16T12:00:00Z");
    expect(rangeSince(null, today)).toBe("10y");
    expect(rangeSince("2026-10-15", today)).toBe("5d");
    expect(rangeSince("2026-10-01", today)).toBe("1mo");
    expect(rangeSince("2026-06-01", today)).toBe("1y");
    expect(rangeSince("2020-01-01", today)).toBe("10y");
  });

  it("normaliserar och validerar symboler", () => {
    expect(normalizeSymbol(" novo-b.co ")).toBe("NOVO-B.CO");
    expect(normalizeSymbol("^omx")).toBe("^OMX");
    expect(normalizeSymbol("USDSEK=X")).toBe("USDSEK=X");
    expect(normalizeSymbol("drop table;")).toBeNull();
    expect(normalizeSymbol("")).toBeNull();
  });
});

describe("demoleverantören", () => {
  it("ger samma serie varje gång och bara vardagar", async () => {
    const demo = createDemoProvider();
    const a = await demo.history("^OMX", "1mo");
    const b = await demo.history("^OMX", "1mo");
    expect(a.points).toEqual(b.points);
    expect(a.points.length).toBeGreaterThan(15);
    for (const p of a.points) expect([0, 6]).not.toContain(new Date(`${p.date}T12:00:00Z`).getUTCDay());
  });

  it("ger 404 för okända symboler", async () => {
    await expect(createDemoProvider().profile("FINNSINTE")).rejects.toMatchObject({ status: 404 });
  });
});

describe("jämförelseindex", () => {
  it("delar ut nästa lediga färg och reserverar series-1 för portföljen", () => {
    expect(BENCHMARK_COLORS.map((c) => c.token)).not.toContain("series-1");
    expect(nextColor([])).toBe("series-2");
    expect(nextColor(["series-2", "series-3"])).toBe("series-4");
    expect(isBenchmarkColor("series-1")).toBe(false);
  });
});
