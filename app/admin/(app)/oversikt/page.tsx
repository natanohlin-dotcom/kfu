import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardWidget } from "@/components/widgets/Widgets";
import { PerformancePlaceholder } from "@/components/widgets/PerformancePlaceholder";
import { requireUser } from "@/lib/auth/dal";
import { listBenchmarks } from "@/lib/benchmarks";
import { getDb } from "@/lib/db";
import { greeting, longDate } from "@/lib/format";
import { dashboardWidgetsFor } from "@/lib/modules";

export const metadata: Metadata = { title: "Översikt" };


export default async function OverviewPage() {
  const user = await requireUser("dashboard:read");
  const widgets = dashboardWidgetsFor(user);
  const benchmarks = await listBenchmarks(getDb());
  const main = benchmarks.find((b) => b.isDefault) ?? benchmarks[0];
  // Portföljens nyckeltal kopplas in i fas 3; jämförelsen använder standardindexet
  const kpis = [
    { label: "Portföljvärde", hint: "SEK, senaste stängning" },
    { label: "Avkastning i år", hint: "Tidsviktad" },
    { label: main ? `Mot ${main.label} i år` : "Mot index i år", hint: "Procentenheter" },
    { label: "Likvida medel", hint: "SEK" },
  ];
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title={`${greeting()}, ${firstName}`} description={longDate()} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg bg-surface px-5 py-5 sm:px-6">
            <div className="text-sm text-ink-muted">{k.label}</div>
            <div className="tabular mt-3 text-[1.75rem] leading-none text-ink-subtle">–</div>
            <div className="mt-2 text-xs text-ink-subtle">{k.hint}</div>
          </div>
        ))}
      </div>

      <PerformancePlaceholder benchmarks={benchmarks} />

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
