import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Calculator, FileText } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { AddBenchmarkButton } from "@/components/market/AddBenchmarkButton";
import { AnalystCard } from "@/components/market/AnalystCard";
import { StatSection, type Stat } from "@/components/market/StatSection";
import { WatchPanel } from "@/components/watchlist/WatchPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { listBenchmarks } from "@/lib/benchmarks";
import { getDb } from "@/lib/db";
import { bigAmount, count, dateTime, num, percent, price, shortDate, signedPercent } from "@/lib/format";
import {
  getMarket,
  KIND_LABELS,
  MarketDataError,
  normalizeSymbol,
  providerName,
  type CompanyDetails,
  type PriceHistory,
  type SecurityProfile,
} from "@/lib/market";
import { isPeriod, PERIODS, periodReturn, slicePeriod, type PeriodId } from "@/lib/market/returns";
import { findSecurityBySymbol } from "@/lib/securities";
import { listActiveUsers } from "@/lib/users";
import { getWatchItemBySymbol, listNotes } from "@/lib/watchlist/repo";

export async function generateMetadata({ params }: PageProps<"/admin/bolag/[symbol]">): Promise<Metadata> {
  return { title: decodeURIComponent((await params).symbol).toUpperCase() };
}


/**
 * Bolagssidan (PLAN.md §7): kurs, graf med perioder, avkastning, nyckeltal, handel, lönsamhet,
 * finansiell ställning, utdelning, analytiker, kalender, ägare och bolagsprofil – i Avanzas omfattning.
 * Bevakning, analyser och DCF kopplas in i fas 4–6.
 */
export default async function SecurityPage({ params, searchParams }: PageProps<"/admin/bolag/[symbol]">) {
  const user = await requireUser("dashboard:read");
  const symbol = normalizeSymbol(decodeURIComponent((await params).symbol));
  if (!symbol) notFound();
  const requested = (await searchParams).period;
  const period: PeriodId = isPeriod(requested) ? requested : "1y";

  const db = getDb();
  const market = getMarket(db);

  let profile: SecurityProfile;
  try {
    profile = await market.profile(symbol);
  } catch (err) {
    if (err instanceof MarketDataError && err.status === 404) notFound();
    return <Unavailable symbol={symbol} />;
  }

  const [quotes, tracked, benchmarks, history, details, watch, users] = await Promise.all([
    market.quotes([symbol]),
    findSecurityBySymbol(db, symbol),
    listBenchmarks(db),
    market.history(symbol, "5y").catch((): PriceHistory | null => null),
    market.details(symbol).catch((): CompanyDetails | null => null),
    getWatchItemBySymbol(db, symbol),
    listActiveUsers(),
  ]);
  const notes = watch ? await listNotes(db, watch.id) : [];

  const q = quotes[0];
  const points = history?.points ?? [];
  const chartPoints = slicePeriod(points, period);
  const chartChange = chartPoints.length > 1 ? chartPoints.at(-1)!.adjClose / chartPoints[0].adjClose - 1 : null;
  const isBenchmark = benchmarks.some((b) => b.security.symbol === symbol);
  const canAddBenchmark = !isBenchmark && can(user, "settings:benchmarks") && ["index", "etf", "fund"].includes(profile.kind);
  const demo = providerName() === "demo";
  const ccy = profile.currency;
  const fcy = details?.financialCurrency ?? ccy;
  const periodLabel = PERIODS.find((p) => p.id === period)!.label;

  // Nyckeltal i högerkolumnen när de finns (aktier); annars (index, valuta) tar handelsdatan platsen
  const valuationStats: Stat[] = [
    { label: "Börsvärde", value: details ? nullable(bigAmount(details.valuation.marketCap, ccy)) : null },
    { label: "P/E", value: num(details?.valuation.trailingPE), hint: "Kurs / vinst per aktie, senaste 12 mån" },
    { label: "P/E framåt", value: num(details?.valuation.forwardPE), hint: "Kurs / förväntad vinst per aktie" },
    { label: "P/S", value: num(details?.valuation.priceToSales), hint: "Börsvärde / omsättning, senaste 12 mån" },
    { label: "P/EK", value: num(details?.valuation.priceToBook), hint: "Kurs / eget kapital per aktie" },
    { label: "EV/EBITDA", value: num(details?.valuation.evToEbitda) },
    { label: "EV/S", value: num(details?.valuation.evToRevenue) },
    { label: "PEG", value: num(details?.valuation.pegRatio, 2) },
    { label: "Direktavkastning", value: percent(details?.dividend.yield, 2) },
    { label: "Vinst/aktie", value: details?.perShare.trailingEps != null ? price(details.perShare.trailingEps, fcy) : null },
    { label: "Beta", value: num(details?.trading.beta, 2), hint: "Kursens känslighet mot marknaden" },
  ];
  const hasValuation = valuationStats.some((v) => v.value !== null);
  const tradingStats: Stat[] = [
    { label: "Öppning", value: details ? nullable(price(details.trading.open, null)) : null },
    { label: "Dagens högsta", value: details ? nullable(price(details.trading.dayHigh, null)) : null },
    { label: "Dagens lägsta", value: details ? nullable(price(details.trading.dayLow, null)) : null },
    { label: "Föregående stängning", value: details ? nullable(price(details.trading.previousClose, null)) : null },
    { label: "Volym", value: count(details?.trading.volume) },
    { label: "Snittvolym", value: count(details?.trading.averageVolume) },
    { label: "52 v högsta", value: nullable(price(details?.trading.fiftyTwoWeekHigh ?? q?.fiftyTwoWeekHigh, null)) },
    { label: "52 v lägsta", value: nullable(price(details?.trading.fiftyTwoWeekLow ?? q?.fiftyTwoWeekLow, null)) },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader
        title={profile.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{[profile.symbol, profile.exchange, KIND_LABELS[profile.kind]].filter(Boolean).join(" · ")}</span>
            {isBenchmark && <Badge tone="accent">Jämförelseindex</Badge>}
            {watch && watch.status !== "arkiverad" && <Badge tone="accent">Bevakas</Badge>}
            {tracked && !isBenchmark && !watch && <Badge>Följs</Badge>}
            {demo && <Badge tone="warn">Demodata</Badge>}
          </span>
        }
        actions={canAddBenchmark ? <AddBenchmarkButton symbol={symbol} label={profile.name.slice(0, 40)} /> : undefined}
      />

      {/* Kurs, graf och avkastning | nyckeltal */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-ink-muted">Senaste kurs</div>
              <div className="tabular mt-2 text-[2.5rem] leading-none text-ink">{price(q?.price, ccy)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {q?.changePercent != null && <Change value={q.changePercent} suffix="idag" digits={2} />}
                {q?.marketTime && <span className="text-ink-subtle">{dateTime(q.marketTime)}</span>}
              </div>
            </div>
            <PeriodPicker symbol={symbol} period={period} />
          </div>

          <div className="mt-6">
            {chartPoints.length > 1 ? (
              <Sparkline values={chartPoints.map((p) => p.close)} label={`Kursutveckling för ${profile.name}, ${periodLabel}`} />
            ) : (
              <p className="py-12 text-center text-sm text-ink-muted">Ingen kurshistorik för perioden.</p>
            )}
            {chartChange != null && (
              <p className="mt-2 text-sm text-ink-muted">
                {periodLabel}: <Change value={chartChange} />
                <span className="text-ink-subtle"> · {shortDate(chartPoints[0].date)} – {shortDate(chartPoints.at(-1)!.date)}</span>
              </p>
            )}
          </div>

          {points.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {PERIODS.map((p) => {
                const r = periodReturn(points, p.id);
                return (
                  <div key={p.id} className="rounded-md bg-fill px-2 py-2.5 text-center">
                    <div className="text-xs text-ink-muted">{p.label}</div>
                    <div className={`tabular mt-1 text-sm ${r == null ? "text-ink-subtle" : r >= 0 ? "text-up" : "text-down"}`}>
                      {r == null ? "–" : signedPercent(r)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {hasValuation ? (
          <StatSection title="Nyckeltal" stats={valuationStats} footer={<SourceNote demo={demo} />} />
        ) : (
          <StatSection title="Handel" stats={tradingStats} footer={<SourceNote demo={demo} />} />
        )}
      </div>

      {profile.kind !== "fx" && can(user, "watchlist:read") && (
        <WatchPanel
          symbol={symbol}
          name={profile.name}
          currency={profile.currency}
          currentPrice={q?.price ?? null}
          item={watch}
          notes={notes}
          users={users}
          canWrite={can(user, "watchlist:write")}
        />
      )}

      {!details && profile.kind === "stock" && (
        <Card tone="fill" className="mt-4 lg:mt-5">
          <p className="text-sm text-ink-muted">Nyckeltal, ägare och bolagsprofil kunde inte hämtas just nu. Kurs och graf ovan fungerar ändå.</p>
        </Card>
      )}

      {details && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-5 lg:gap-5 xl:grid-cols-3">
            {hasValuation && <StatSection title="Handel" stats={tradingStats} />}
            <StatSection
              title="Lönsamhet och tillväxt"
              stats={[
                { label: "Omsättning (12 mån)", value: nullable(bigAmount(details.profitability.totalRevenue, fcy)) },
                { label: "Omsättningstillväxt", value: signedOrNull(details.profitability.revenueGrowth), tone: tone(details.profitability.revenueGrowth), hint: "Senaste kvartalet mot samma kvartal i fjol" },
                { label: "Vinsttillväxt", value: signedOrNull(details.profitability.earningsGrowth), tone: tone(details.profitability.earningsGrowth) },
                { label: "Bruttomarginal", value: percent(details.profitability.grossMargin) },
                { label: "Rörelsemarginal", value: percent(details.profitability.operatingMargin) },
                { label: "EBITDA-marginal", value: percent(details.profitability.ebitdaMargin) },
                { label: "Vinstmarginal", value: percent(details.profitability.profitMargin) },
                { label: "Avkastning på eget kapital", value: percent(details.profitability.returnOnEquity) },
                { label: "Avkastning på totalt kapital", value: percent(details.profitability.returnOnAssets) },
              ]}
            />
            <StatSection
              title="Finansiell ställning"
              stats={[
                { label: "Kassa", value: nullable(bigAmount(details.financialHealth.totalCash, fcy)) },
                { label: "Total skuld", value: nullable(bigAmount(details.financialHealth.totalDebt, fcy)) },
                { label: "Nettokassa", value: details.financialHealth.totalCash != null && details.financialHealth.totalDebt != null ? bigAmount(details.financialHealth.totalCash - details.financialHealth.totalDebt, fcy) : null },
                { label: "Skuldsättningsgrad", value: num(details.financialHealth.debtToEquity, 2), hint: "Skuld / eget kapital" },
                { label: "Balanslikviditet", value: num(details.financialHealth.currentRatio, 2), hint: "Omsättningstillgångar / kortfristiga skulder" },
                { label: "Kassalikviditet", value: num(details.financialHealth.quickRatio, 2) },
                { label: "Operativt kassaflöde", value: nullable(bigAmount(details.financialHealth.operatingCashflow, fcy)) },
                { label: "Fritt kassaflöde", value: nullable(bigAmount(details.financialHealth.freeCashflow, fcy)) },
              ]}
            />
            <StatSection
              title="Utdelning"
              stats={[
                { label: "Utdelning/aktie (år)", value: details.dividend.rate != null ? price(details.dividend.rate, ccy) : null },
                { label: "Direktavkastning", value: percent(details.dividend.yield, 2) },
                { label: "Snitt 5 år", value: percent(details.dividend.fiveYearAvgYield, 2) },
                { label: "Utdelningsandel", value: percent(details.dividend.payoutRatio), hint: "Utdelning / vinst" },
                { label: "Senaste X-dag", value: details.dividend.exDate ? shortDate(details.dividend.exDate) : null },
                { label: "Utbetalning", value: details.dividend.payDate ? shortDate(details.dividend.payDate) : null },
              ]}
            />
            <StatSection
              title="Aktien och kalender"
              stats={[
                { label: "Nästa rapport", value: details.calendar.nextEarnings ? shortDate(details.calendar.nextEarnings) : null },
                { label: "Antal aktier", value: count(details.perShare.sharesOutstanding), hint: "Det noterade aktieslaget enligt källan" },
                { label: "Antal aktier, alla slag", value: count(details.perShare.impliedSharesOutstanding), hint: "Inkl. andra aktieslag (t.ex. A+B)" },
                { label: "Eget kapital/aktie", value: details.perShare.bookValue != null ? price(details.perShare.bookValue, fcy) : null },
                { label: "Förväntad vinst/aktie", value: details.perShare.forwardEps != null ? price(details.perShare.forwardEps, fcy) : null },
                { label: "Enterprise value (EV)", value: nullable(bigAmount(details.valuation.enterpriseValue, ccy)), hint: "Börsvärde + nettoskuld" },
              ]}
            />
          </div>

          <AnalystCard details={details} currentPrice={q?.price ?? null} />

          <div className="mt-4 grid items-start gap-4 lg:mt-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
            <AboutCompany details={details} />
            <Owners details={details} />
          </div>
        </>
      )}

      {profile.kind === "stock" && (
      <Card tone="fill" className="mt-4 lg:mt-5" title="Kommer på bolagssidan">
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <Upcoming icon={<Calculator className="size-4" />} title="DCF och räkenskaper" text="Historik, scenarier och känslighet" phase={5} />
          <Upcoming icon={<FileText className="size-4" />} title="Analyser" text="Utkast och färdiga rapporter" phase={6} />
        </ul>
      </Card>
      )}
    </div>
  );
}

function nullable(s: string): string | null {
  return s === "–" ? null : s;
}

function signedOrNull(v: number | null): string | null {
  return v == null ? null : signedPercent(v);
}

function tone(v: number | null | undefined): "up" | "down" | undefined {
  return v == null ? undefined : v >= 0 ? "up" : "down";
}

function Change({ value, suffix, digits = 1 }: { value: number; suffix?: string; digits?: number }) {
  return (
    <span className={`tabular ${value >= 0 ? "text-up" : "text-down"}`}>
      {signedPercent(value, digits)}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}

function PeriodPicker({ symbol, period }: { symbol: string; period: PeriodId }) {
  return (
    <nav aria-label="Period" className="flex flex-wrap rounded-sm bg-fill p-1">
      {PERIODS.map((p) => (
        <Link
          key={p.id}
          href={`/admin/bolag/${encodeURIComponent(symbol)}?period=${p.id}`}
          scroll={false}
          replace
          aria-current={p.id === period ? "true" : undefined}
          className={`rounded-[7px] px-2.5 py-1 text-[0.8125rem] transition-colors ${p.id === period ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

function AboutCompany({ details }: { details: CompanyDetails }) {
  const p = details.profile;
  const facts: Stat[] = [
    { label: "Sektor", value: p.sector },
    { label: "Bransch", value: p.industry },
    { label: "VD", value: p.ceo },
    { label: "Anställda", value: p.employees != null ? new Intl.NumberFormat("sv-SE").format(p.employees) : null },
    { label: "Säte", value: [p.city, p.country].filter(Boolean).join(", ") || null },
  ];
  if (!p.description && facts.every((f) => f.value === null)) return null;
  return (
    <Card title="Om bolaget">
      {p.description && p.description.length <= 320 && <p className="text-ink" lang="en">{p.description}</p>}
      {p.description && p.description.length > 320 && (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <p className="line-clamp-4 text-ink group-open:line-clamp-none" lang="en">
              {p.description}
            </p>
            <span className="mt-2 inline-block text-sm text-accent group-open:hidden">Visa hela beskrivningen</span>
          </summary>
        </details>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {facts
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label}>
              <dt className="text-ink-muted">{f.label}</dt>
              <dd className="text-ink">{f.value}</dd>
            </div>
          ))}
        {p.website && (
          <div>
            <dt className="text-ink-muted">Webbplats</dt>
            <dd>
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {p.description && <p className="mt-4 text-xs text-ink-subtle">Beskrivningen kommer från källan och är på engelska.</p>}
    </Card>
  );
}

function Owners({ details }: { details: CompanyDetails }) {
  const o = details.ownership;
  if (o.insidersPercent == null && o.institutionsPercent == null && o.topHolders.length === 0) return null;
  return (
    <Card title="Ägare">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-fill px-4 py-3">
          <div className="text-xs text-ink-muted">Insynspersoner</div>
          <div className="tabular mt-1 text-lg text-ink">{percent(o.insidersPercent) ?? "–"}</div>
        </div>
        <div className="rounded-md bg-fill px-4 py-3">
          <div className="text-xs text-ink-muted">Institutioner</div>
          <div className="tabular mt-1 text-lg text-ink">{percent(o.institutionsPercent) ?? "–"}</div>
        </div>
      </div>
      {o.topHolders.length > 0 && (
        <table className="mt-5 w-full text-sm">
          <caption className="mb-2 text-left text-ink-muted">Största institutionella ägare</caption>
          <thead className="sr-only">
            <tr>
              <th>Ägare</th>
              <th>Andel</th>
            </tr>
          </thead>
          <tbody>
            {o.topHolders.map((h) => (
              <tr key={h.name} className="border-b border-line last:border-0">
                <td className="py-2 pr-3 text-ink">{h.name}</td>
                <td className="tabular py-2 text-right text-ink">{percent(h.percent, 2) ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-xs text-ink-subtle">
        Källan redovisar främst institutioner som rapporterar till amerikanska myndigheter. Svenska ägarlistor (som Avanza visar från Holdings) ingår inte.
      </p>
    </Card>
  );
}

function SourceNote({ demo }: { demo: boolean }) {
  return demo ? <>Demodata, påhittade värden för lokal utveckling.</> : <>Källa: Yahoo Finance. Kurser kan vara fördröjda.</>;
}

function Upcoming({ icon, title, text, phase }: { icon: ReactNode; title: string; text: string; phase: number }) {
  return (
    <li className="flex gap-3 rounded-md bg-surface/60 p-4">
      <span className="mt-0.5 text-ink-muted">{icon}</span>
      <span>
        <span className="block text-ink">{title}</span>
        <span className="block text-ink-muted">{text}</span>
        <span className="mt-1 block text-xs text-ink-subtle">Fas {phase}</span>
      </span>
    </li>
  );
}

function Unavailable({ symbol }: { symbol: string }) {
  return (
    <div>
      <PageHeader title={symbol} description="Marknadsdata kunde inte hämtas just nu." />
      <Card>
        <p className="text-ink-muted">Källan svarar inte. Försök igen om en stund.</p>
      </Card>
    </div>
  );
}
