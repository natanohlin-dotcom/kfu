import type { Metadata } from "next";
import Link from "next/link";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Kpi, toneOf } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardWidget } from "@/components/widgets/Widgets";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { greeting, longDate, percent, sek, signedPercent } from "@/lib/format";
import { getMarket } from "@/lib/market";
import { dashboardWidgetsFor } from "@/lib/modules";
import { loadPortfolio } from "@/lib/portfolio/overview";

export const metadata: Metadata = { title: "Översikt" };

/** Välkomstsidan (PLAN.md §7): nyckeltal, portföljen mot jämförelseindex och modulernas widgets. */
export default async function OverviewPage() {
  const user = await requireUser("dashboard:read");
  const widgets = dashboardWidgetsFor(user);
  const db = getDb();
  const p = await loadPortfolio(db, getMarket(db));
  const main = p.mainBenchmark;
  const relative = p.ytd != null && main?.ytdSameSpan != null ? p.ytd - main.ytdSameSpan : null;
  const firstName = user.displayName.split(" ")[0];
  const pp = (v: number) => `${v >= 0 ? "+" : "−"}${new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v * 100))} p.e.`;

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title={`${greeting()}, ${firstName}`} description={longDate()} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <Kpi label="Portföljvärde" value={p.hasTransactions ? sek(p.totalSek) : null} hint="SEK, inkl. likvida medel" />
        <Kpi label="Avkastning i år" value={p.ytd != null ? signedPercent(p.ytd) : null} tone={toneOf(p.ytd)} hint="Tidsviktad" />
        <Kpi
          label={main ? `Mot ${main.label} i år` : "Mot index i år"}
          value={relative != null ? pp(relative) : null}
          tone={toneOf(relative)}
          hint={main?.ytdSameSpan != null ? `${main.label} ${signedPercent(main.ytdSameSpan)} samma period` : "Procentenheter"}
        />
        <Kpi label="Likvida medel" value={p.hasTransactions ? sek(p.cashSek) : null} hint={p.totalSek > 0 ? `${percent(p.cashSek / p.totalSek)} av portföljen` : "SEK"} />
      </div>

      <Card
        title="Portfölj mot jämförelseindex"
        description="Utveckling i procent från periodens start. Portföljen som tidsviktad avkastning, index med utdelningsjusterade kurser."
        action={
          <Link href="/admin/installningar/jamforelseindex" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Ändra index
          </Link>
        }
      >
        <PerformanceChart
          series={p.chart}
          emptyNote={p.hasTransactions ? undefined : "Portföljen visas här när den första insättningen är registrerad under Transaktioner."}
        />
        {!p.hasTransactions && can(user, "portfolio:write") && (
          <Link href="/admin/portfolj/transaktioner" className={`${buttonStyles({ variant: "secondary", size: "sm" })} mt-4`}>
            Registrera första insättningen
          </Link>
        )}
      </Card>

      {widgets.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-5 lg:gap-5 xl:grid-cols-3">
          {widgets.map(({ widget, module }) => (
            <DashboardWidget key={widget} widget={widget} module={module} />
          ))}
        </div>
      )}
    </div>
  );
}
