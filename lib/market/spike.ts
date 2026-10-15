import * as yahoo from "./yahoo";

/**
 * Fas 0-spike: testar varje Yahoo-ändpunkt som planen bygger på, från där koden körs
 * (lokalt eller i Cloudflare), och sammanfattar vad som fungerar.
 */

type Check = {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  bytes: number;
  summary: string;
  error?: string;
};

function check<T>(name: string, r: yahoo.YahooCall<T>, summarize: (d: T) => { ok: boolean; summary: string }): Check {
  const base = { name, status: r.status, ms: r.ms, bytes: r.bytes };
  if (!r.data) return { ...base, ok: false, summary: "inget data", error: r.error };
  try {
    return { ...base, ...summarize(r.data) };
  } catch (err) {
    return { ...base, ok: false, summary: "oväntad struktur", error: String(err) };
  }
}

const summarizeChart = (d: yahoo.ChartResponse) => {
  const r = d.chart.result?.[0];
  if (!r) return { ok: false, summary: `fel: ${JSON.stringify(d.chart.error).slice(0, 120)}` };
  const closes = r.indicators.quote[0]?.close ?? [];
  const last = closes.filter((c) => c != null).at(-1);
  const lastDate = r.timestamp?.length ? new Date(r.timestamp.at(-1)! * 1000).toISOString().slice(0, 10) : "?";
  return {
    ok: closes.length > 0,
    summary: `${closes.length} dagar, senast ${lastDate} = ${last?.toFixed(2)} ${r.meta.currency} (${r.meta.exchangeName})`,
  };
};

const summarizeTimeseries = (d: yahoo.TimeseriesResponse) => {
  const results = d.timeseries.result ?? [];
  const filled = results.filter((r) => {
    const t = r.meta.type[0];
    return Array.isArray(r[t]) && (r[t] as unknown[]).length > 0;
  });
  const sample = filled.find((r) => r.meta.type[0] === "annualTotalRevenue");
  const years = sample
    ? (sample.annualTotalRevenue as ({ asOfDate: string } | null)[]).filter(Boolean).map((p) => p!.asOfDate.slice(0, 4))
    : [];
  const missing = yahoo.DCF_TIMESERIES_TYPES.filter((t) => !filled.some((r) => r.meta.type[0] === t));
  return {
    ok: filled.length > 0,
    summary:
      `${filled.length}/${yahoo.DCF_TIMESERIES_TYPES.length} rader med data` +
      (years.length ? `, omsättning för ${years.join(", ")}` : "") +
      (missing.length ? `; saknas: ${missing.join(", ")}` : ""),
  };
};

export type SpikeResult = {
  ranAt: string;
  trigger: "http" | "cron";
  symbol: string;
  colo?: string;
  session: yahoo.SessionAttempt["steps"];
  checks: Check[];
  allOk: boolean;
};

export async function runYahooSpike(
  db: D1Database,
  opts: { symbol: string; benchmark: string; trigger: "http" | "cron"; colo?: string; freshSession?: boolean },
): Promise<SpikeResult> {
  const { symbol, benchmark } = opts;
  const checks: Check[] = [];

  // Utan crumb
  checks.push(check(`chart ${symbol} (v8)`, await yahoo.chart(symbol), summarizeChart));
  checks.push(check(`chart ${benchmark} (v8, index)`, await yahoo.chart(benchmark), summarizeChart));
  checks.push(check("chart USDSEK=X (v8, valuta)", await yahoo.chart("USDSEK=X", "1mo"), summarizeChart));
  checks.push(
    check("search 'novo nordisk' (v1)", await yahoo.search("novo nordisk"), (d) => ({
      ok: d.quotes.length > 0,
      summary: d.quotes.slice(0, 4).map((q) => q.symbol).join(", "),
    })),
  );
  checks.push(
    check("timeseries utan crumb", await yahoo.timeseries(symbol, yahoo.DCF_TIMESERIES_TYPES, null), summarizeTimeseries),
  );

  // Med crumb
  const attempt = await yahoo.getSession(db, opts.freshSession);
  const s = attempt.session;
  if (!s) {
    checks.push({ name: "cookie + crumb", ok: false, status: 0, ms: 0, bytes: 0, summary: "ingen session, se session-stegen" });
  } else {
    checks.push(
      check(`quote ${symbol},${benchmark} (v7)`, await yahoo.quote([symbol, benchmark], s), (d) => ({
        ok: d.quoteResponse.result.length > 0,
        summary: d.quoteResponse.result
          .map((q) => `${q.symbol}: ${q.regularMarketPrice} ${q.currency ?? ""}, mcap ${q.marketCap ?? "–"}`)
          .join(" | "),
      })),
    );
    checks.push(
      check(
        `quoteSummary ${symbol} (v10)`,
        await yahoo.quoteSummary(
          symbol,
          ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile"],
          s,
        ),
        (d) => {
          const r = d.quoteSummary.result?.[0] as Record<string, Record<string, unknown>> | undefined;
          if (!r) return { ok: false, summary: `fel: ${JSON.stringify(d.quoteSummary.error).slice(0, 120)}` };
          const stats = r.defaultKeyStatistics ?? {};
          const fin = r.financialData ?? {};
          const raw = (v: unknown) => (v as { raw?: number } | undefined)?.raw ?? "–";
          return {
            ok: true,
            summary:
              `moduler: ${Object.keys(r).join(", ")}; land ${r.assetProfile?.country ?? "–"}, ` +
              `sharesOutstanding ${raw(stats.sharesOutstanding)}, impliedShares ${raw(stats.impliedSharesOutstanding)}, ` +
              `totalCash ${raw(fin.totalCash)}, totalDebt ${raw(fin.totalDebt)}, financialCurrency ${fin.financialCurrency ?? "–"}`,
          };
        },
      ),
    );
    checks.push(
      check("timeseries med crumb", await yahoo.timeseries(symbol, yahoo.DCF_TIMESERIES_TYPES, s), summarizeTimeseries),
    );
  }

  const result: SpikeResult = {
    ranAt: new Date().toISOString(),
    trigger: opts.trigger,
    symbol,
    colo: opts.colo,
    session: attempt.steps,
    checks,
    allOk: checks.every((c) => c.ok),
  };

  await db
    .prepare(
      "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(`spike.yahoo.${opts.trigger}`, JSON.stringify(result), result.ranAt)
    .run();

  return result;
}
