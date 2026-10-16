import { Card } from "@/components/ui/Card";
import { bigAmount, price, shortDate, signedPercent } from "@/lib/format";
import type { AnalystEstimate, CompanyDetails, RecommendationCounts } from "@/lib/market/types";

/**
 * Analytikernas syn (som Avanza): fördelning köp/behåll/sälj med trend, riktkurser mot dagens kurs
 * och vinst-/omsättningsestimat. Visas bara när källan har analytikerdata.
 */

const SEGMENTS = [
  { key: "strongBuy", label: "Starkt köp", bar: "bg-up", dot: "bg-up" },
  { key: "buy", label: "Köp", bar: "bg-up/55", dot: "bg-up/55" },
  { key: "hold", label: "Behåll", bar: "bg-ink-subtle/60", dot: "bg-ink-subtle/60" },
  { key: "sell", label: "Sälj", bar: "bg-down/55", dot: "bg-down/55" },
  { key: "strongSell", label: "Starkt sälj", bar: "bg-down", dot: "bg-down" },
] as const;

export const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: "Starkt köp",
  buy: "Köp",
  hold: "Behåll",
  underperform: "Svag sälj",
  sell: "Sälj",
};

const MONTHS = ["Nu", "1 mån sedan", "2 mån sedan", "3 mån sedan"];

function total(c: RecommendationCounts) {
  return c.strongBuy + c.buy + c.hold + c.sell + c.strongSell;
}

export function AnalystCard({ details, currentPrice }: { details: CompanyDetails; currentPrice: number | null }) {
  const a = { ...details.analysts, recommendationTrend: details.analysts.recommendationTrend ?? [], estimates: details.analysts.estimates ?? [] };
  const now = a.recommendationTrend[0] ?? null;
  const hasTargets = a.targetMean != null;
  if (!now && !hasTargets && a.estimates.length === 0) return null;

  const ccy = details.currency;
  const fcy = details.financialCurrency ?? details.currency;
  const count = now ? total(now) : a.count;

  return (
    <Card title="Analytiker" description={count ? `${count} analytiker följer bolaget` : undefined} className="mt-4 lg:mt-5">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* Rekommendationer */}
        <div>
          <div className="text-sm text-ink-muted">Rekommendation</div>
          <div className="mt-1 font-display text-[2rem] leading-tight font-medium text-ink">
            {a.recommendation ? RECOMMENDATION_LABELS[a.recommendation] ?? "–" : "–"}
          </div>

          {now ? (
            <>
              <StackedBar counts={now} className="mt-4 h-3" label="Fördelning av rekommendationer nu" />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {SEGMENTS.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5 text-ink-muted">
                    <span className={`size-2 rounded-full ${s.dot}`} aria-hidden />
                    {s.label}
                    <span className="tabular text-ink">{now[s.key]}</span>
                  </li>
                ))}
              </ul>

              {a.recommendationTrend.length > 1 && (
                <div className="mt-6">
                  <div className="mb-2 text-sm text-ink-muted">Utveckling</div>
                  <ul className="flex flex-col gap-2">
                    {a.recommendationTrend.map((c) => (
                      <li key={c.monthsAgo} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                        <span className="text-ink-muted">{MONTHS[c.monthsAgo] ?? `${c.monthsAgo} mån sedan`}</span>
                        <StackedBar counts={c} className="h-2" label={`Fördelning ${MONTHS[c.monthsAgo] ?? ""}`} />
                        <span className="tabular text-right text-ink-muted">{total(c)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Ingen fördelning per rekommendation finns hos källan.</p>
          )}
        </div>

        {/* Riktkurser */}
        {hasTargets && (
          <div>
            <div className="text-sm text-ink-muted">Riktkurs, snitt</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="tabular text-[1.75rem] leading-tight text-ink">{price(a.targetMean, ccy)}</span>
              {currentPrice && a.targetMean && (
                <span className={`tabular text-sm ${a.targetMean >= currentPrice ? "text-up" : "text-down"}`}>
                  {signedPercent(a.targetMean / currentPrice - 1)} mot dagens kurs
                </span>
              )}
            </div>
            <TargetRange low={a.targetLow} mean={a.targetMean} high={a.targetHigh} current={currentPrice} currency={ccy} />
          </div>
        )}
      </div>

      {a.estimates.length > 0 && <Estimates estimates={a.estimates} currency={fcy} />}
    </Card>
  );
}

function StackedBar({ counts, className, label }: { counts: RecommendationCounts; className: string; label: string }) {
  const sum = total(counts);
  if (!sum) return <div className={`rounded-full bg-fill ${className}`} />;
  const text = SEGMENTS.filter((s) => counts[s.key]).map((s) => `${s.label} ${counts[s.key]}`).join(", ");
  return (
    <div className={`flex gap-0.5 overflow-hidden rounded-full ${className}`} role="img" aria-label={`${label}: ${text}`}>
      {SEGMENTS.map((s) =>
        counts[s.key] ? <span key={s.key} className={s.bar} style={{ width: `${(counts[s.key] / sum) * 100}%` }} /> : null,
      )}
    </div>
  );
}

/** Lägsta–högsta riktkurs som en linje, med snitt och dagens kurs inprickade */
function TargetRange({ low, mean, high, current, currency }: { low: number | null; mean: number | null; high: number | null; current: number | null; currency: string }) {
  if (low == null || high == null || high <= low) return null;
  const min = Math.min(low, current ?? low);
  const max = Math.max(high, current ?? high);
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="mt-8">
      <div className="relative h-10" role="img" aria-label={`Riktkurser från ${price(low, currency)} till ${price(high, currency)}${current ? `, dagens kurs ${price(current, currency)}` : ""}`}>
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/25" style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }} />
        {mean != null && <Marker at={pos(mean)} className="bg-accent" title="Snitt" />}
        {current != null && <Marker at={pos(current)} className="bg-ink" title="Kurs idag" tall />}
      </div>
      <div className="mt-1 flex justify-between text-sm">
        <span>
          <span className="block text-ink-muted">Lägsta</span>
          <span className="tabular text-ink">{price(low, currency)}</span>
        </span>
        <span className="text-right">
          <span className="block text-ink-muted">Högsta</span>
          <span className="tabular text-ink">{price(high, currency)}</span>
        </span>
      </div>
      <ul className="mt-3 flex gap-4 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-accent" aria-hidden /> Snitt</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-ink" aria-hidden /> Kurs idag</li>
      </ul>
    </div>
  );
}

function Marker({ at, className, title, tall = false }: { at: string; className: string; title: string; tall?: boolean }) {
  return <span title={title} className={`absolute top-1/2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${tall ? "h-8" : "h-5"} ${className}`} style={{ left: at }} />;
}

function periodLabel(e: AnalystEstimate): string {
  const year = e.endDate?.slice(0, 4);
  if (e.kind === "year") return year ? `Helår ${year}` : e.offset ? "Nästa år" : "Innevarande år";
  return e.endDate ? `Kvartal t.o.m. ${shortDate(e.endDate)}` : e.offset ? "Nästa kvartal" : "Innevarande kvartal";
}

function Growth({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-subtle">–</span>;
  return <span className={value >= 0 ? "text-up" : "text-down"}>{signedPercent(value)}</span>;
}

function Estimates({ estimates, currency }: { estimates: AnalystEstimate[]; currency: string }) {
  const sorted = [...estimates].sort((a, b) => (a.kind === b.kind ? a.offset - b.offset : a.kind === "year" ? -1 : 1));
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-ink">Estimat</h3>
      <div className="-mx-6 overflow-x-auto px-6">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="pb-2 font-normal">Period</th>
              <th className="pb-2 text-right font-normal">Vinst/aktie, snitt</th>
              <th className="pb-2 text-right font-normal">Lägst–högst</th>
              <th className="pb-2 text-right font-normal">Tillväxt</th>
              <th className="pb-2 text-right font-normal">Omsättning, snitt</th>
              <th className="pb-2 text-right font-normal">Tillväxt</th>
              <th className="pb-2 text-right font-normal">Analytiker</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {sorted.map((e) => (
              <tr key={`${e.kind}${e.offset}`} className="border-t border-line">
                <td className="py-2.5 pr-3 text-ink">{periodLabel(e)}</td>
                <td className="py-2.5 text-right text-ink">{price(e.eps.avg, currency)}</td>
                <td className="py-2.5 text-right text-ink-muted">
                  {e.eps.low != null && e.eps.high != null ? `${price(e.eps.low, null)}–${price(e.eps.high, null)}` : "–"}
                </td>
                <td className="py-2.5 text-right"><Growth value={e.eps.growth} /></td>
                <td className="py-2.5 text-right text-ink">{bigAmount(e.revenue.avg, currency)}</td>
                <td className="py-2.5 text-right"><Growth value={e.revenue.growth} /></td>
                <td className="py-2.5 text-right text-ink-muted">{e.eps.analysts ?? e.revenue.analysts ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">Tillväxt jämfört med samma period året innan. Estimaten är analytikernas snitt enligt källan.</p>
    </div>
  );
}
