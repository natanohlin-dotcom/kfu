import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kpi, toneOf } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { num, percent, price, sek, shortDate, signedPercent, signedSek } from "@/lib/format";
import { getMarket, KIND_LABELS } from "@/lib/market";
import { loadPortfolio, type Holding } from "@/lib/portfolio/overview";

export const metadata: Metadata = { title: "Innehav" };

export default async function HoldingsPage() {
  const user = await requireUser("portfolio:read");
  const db = getDb();
  const p = await loadPortfolio(db, getMarket(db));
  const canWrite = can(user, "portfolio:write");
  const action = canWrite ? (
    <Link href="/admin/portfolj/transaktioner" className={buttonStyles()}>
      <Plus className="size-4" aria-hidden /> Ny transaktion
    </Link>
  ) : undefined;

  if (!p.hasTransactions) {
    return (
      <div>
        <PageHeader title="Innehav" actions={action} />
        <Card>
          <EmptyState title="Portföljen är tom">
            Registrera en insättning av startkapitalet och sedan köpen under Transaktioner. Innehav, avkastning och fördelning visas här.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Innehav" description={`Sedan ${shortDate(p.firstDate)} · värden i SEK`} actions={action} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <Kpi label="Portföljvärde" value={sek(p.totalSek)} hint={`Varav innehav ${sek(p.holdingsSek)}`} />
        <Kpi label="Orealiserat resultat" value={signedSek(p.unrealizedSek)} tone={toneOf(p.unrealizedSek)} hint={p.costSek ? `${signedPercent(p.unrealizedSek / p.costSek)} på anskaffningsvärdet` : undefined} />
        <Kpi label="Realiserat + utdelningar" value={signedSek(p.realizedSek + p.dividendsSek)} tone={toneOf(p.realizedSek + p.dividendsSek)} hint={`Utdelningar ${sek(p.dividendsSek)}`} />
        <Kpi label="Likvida medel" value={sek(p.cashSek)} hint={p.totalSek ? `${percent(p.cashSek / p.totalSek)} av portföljen` : undefined} />
      </div>

      <Card title="Innehav" flush className="mb-4 lg:mb-5">
        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="pb-2 font-normal">Värdepapper</th>
                <th className="pb-2 text-right font-normal">Antal</th>
                <th className="pb-2 text-right font-normal">GAV</th>
                <th className="pb-2 text-right font-normal">Kurs</th>
                <th className="pb-2 text-right font-normal">Idag</th>
                <th className="pb-2 text-right font-normal">Värde (SEK)</th>
                <th className="pb-2 text-right font-normal">Andel</th>
                <th className="pb-2 text-right font-normal">Avkastning</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {p.holdings.map((h) => <HoldingRow key={h.securityId} h={h} />)}
              <tr className="border-t border-line">
                <td className="py-3 text-ink">Likvida medel</td>
                <td colSpan={4} />
                <td className="py-3 text-right text-ink">{sek(p.cashSek)}</td>
                <td className="py-3 text-right text-ink-muted">{p.totalSek ? percent(p.cashSek / p.totalSek) : "–"}</td>
                <td />
              </tr>
              <tr className="border-t border-line">
                <td className="py-3 text-ink">Totalt</td>
                <td colSpan={4} />
                <td className="py-3 text-right text-ink">{sek(p.totalSek)}</td>
                <td className="py-3 text-right text-ink-muted">100 %</td>
                <td className={`py-3 text-right ${p.unrealizedSek >= 0 ? "text-up" : "text-down"}`}>{signedSek(p.unrealizedSek)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
        <Card title="Utveckling" description="Tidsviktad avkastning (insättningar och uttag påverkar inte)">
          <PerformanceChart series={p.chart} />
        </Card>
        <div className="flex flex-col gap-4 lg:gap-5">
          <Allocation holdings={p.holdings} cashSek={p.cashSek} totalSek={p.totalSek} />
          <Card tone="fill" title="Kapital">
            <dl className="grid grid-cols-[1fr_auto] gap-y-2.5 text-sm">
              <dt className="text-ink-muted">Insatt</dt><dd className="tabular text-right">{sek(p.depositsSek)}</dd>
              <dt className="text-ink-muted">Uttaget</dt><dd className="tabular text-right">{sek(p.withdrawalsSek)}</dd>
              <dt className="text-ink-muted">Courtage och avgifter</dt><dd className="tabular text-right">{sek(p.feesSek)}</dd>
              <dt className="text-ink-muted">Avkastning sedan start (TWR)</dt>
              <dd className={`tabular text-right ${toneOf(p.sinceStart) === "down" ? "text-down" : "text-up"}`}>{p.sinceStart != null ? signedPercent(p.sinceStart) : "–"}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-3">
        <Link href={`/admin/bolag/${encodeURIComponent(h.symbol)}`} className="text-ink hover:underline">{h.name}</Link>
        <div className="text-xs text-ink-muted">{h.symbol} · {KIND_LABELS[h.kind]}{h.currency !== "SEK" ? ` · ${h.currency}` : ""}</div>
      </td>
      <td className="py-3 text-right text-ink">{num(h.quantity, h.quantity % 1 ? 2 : 0)}</td>
      <td className="py-3 text-right text-ink">{price(h.gavLocal, null)}</td>
      <td className="py-3 text-right text-ink">{price(h.price, null)}</td>
      <td className={`py-3 text-right ${h.changePercent == null ? "text-ink-subtle" : h.changePercent >= 0 ? "text-up" : "text-down"}`}>{h.changePercent == null ? "–" : signedPercent(h.changePercent, 2)}</td>
      <td className="py-3 text-right text-ink">{sek(h.valueSek)}</td>
      <td className="py-3 text-right text-ink-muted">{percent(h.weight)}</td>
      <td className={`py-3 text-right ${h.unrealizedSek >= 0 ? "text-up" : "text-down"}`}>
        {signedSek(h.unrealizedSek)}
        <div className="text-xs">{h.unrealizedPct != null ? signedPercent(h.unrealizedPct) : ""}</div>
      </td>
    </tr>
  );
}

/** Fördelning per sektor (storlek → en färg, staplar sorterade efter storlek) */
function Allocation({ holdings, cashSek, totalSek }: { holdings: Holding[]; cashSek: number; totalSek: number }) {
  if (totalSek <= 0) return null;
  const groups = new Map<string, number>();
  for (const h of holdings) {
    const key = h.kind === "stock" ? h.sector ?? "Övrigt" : KIND_LABELS[h.kind];
    groups.set(key, (groups.get(key) ?? 0) + h.valueSek);
  }
  if (cashSek > 0) groups.set("Likvida medel", cashSek);
  const rows = [...groups].sort((a, b) => b[1] - a[1]);
  return (
    <Card title="Fördelning">
      <ul className="flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <li key={label} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink">{label}</span>
              <span className="tabular text-ink-muted">{percent(value / totalSek)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-fill">
              <div className={`h-full rounded-full ${label === "Likvida medel" ? "bg-ink-subtle/60" : "bg-series-1"}`} style={{ width: `${(value / totalSek) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
