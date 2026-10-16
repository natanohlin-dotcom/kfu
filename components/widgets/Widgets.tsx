import Link from "next/link";
import { Activity as ActivityIcon, ArrowLeftRight, Eye, FileText, LineChart, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listActivity, type Activity } from "@/lib/activity";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { price, relativeTime, signedPercent } from "@/lib/format";
import { getMarket } from "@/lib/market";
import type { ModuleDef, WidgetId } from "@/lib/modules";
import type { PublicUser } from "@/lib/users";
import { listWatchItems } from "@/lib/watchlist/repo";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/watchlist/status";
import { withQuotes } from "@/lib/watchlist/view";

/**
 * Widgets på översikten. Varje widget hör till en modul i lib/modules.ts och hämtar sin egen data
 * (server components), så att översikten växer med modulerna utan att ändras.
 */

type WidgetProps = { module: ModuleDef; user: PublicUser };

const moreLink = (href: string, label: string) => (
  <Link href={href} className="text-sm text-accent hover:underline">{label}</Link>
);

async function WatchlistMovers({ user }: WidgetProps) {
  const db = getDb();
  const rows = await withQuotes(await listWatchItems(db), getMarket(db));
  const movers = [...rows].sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)).slice(0, 5);
  return (
    <Card title="Bevakningar – störst rörelse idag" action={rows.length ? moreLink("/admin/bevakningar", "Alla") : undefined}>
      {movers.length === 0 ? (
        <EmptyState icon={<Eye className="size-5" />} title="Inga bevakningar ännu">
          {can(user, "watchlist:write") ? <Link href="/admin/bevakningar" className="text-accent hover:underline">Inled en bevakning</Link> : "Bevakade bolag visas här."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {movers.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <Link href={`/admin/bolag/${encodeURIComponent(r.security.symbol)}`} className="block truncate text-ink hover:underline">{r.security.name}</Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                  <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  {r.distance != null && <span className="tabular">{signedPercent(r.distance)} till mål</span>}
                </div>
              </div>
              <div className="tabular shrink-0 text-right text-sm">
                <div className="text-ink">{price(r.price, null)}</div>
                <div className={r.changePercent == null ? "text-ink-subtle" : r.changePercent >= 0 ? "text-up" : "text-down"}>
                  {r.changePercent == null ? "–" : signedPercent(r.changePercent, 2)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActiveAnalyses({ module }: WidgetProps) {
  return (
    <Card title="Pågående analyser">
      <EmptyState icon={<FileText className="size-5" />} title="Inga analyser ännu">
        Utkast och analyser som väntar på granskning listas här.
        {!module.enabled && <span className="mt-2 block text-xs text-ink-subtle">Byggs i fas {module.phase}</span>}
      </EmptyState>
    </Card>
  );
}

const ACTIVITY_ICONS: Record<string, ReactNode> = {
  transaction: <ArrowLeftRight className="size-3.5" aria-hidden />,
  watchlist: <Eye className="size-3.5" aria-hidden />,
  benchmark: <LineChart className="size-3.5" aria-hidden />,
};

function activityIcon(a: Activity) {
  return a.action === "watchlist.note" ? <MessageSquare className="size-3.5" aria-hidden /> : ACTIVITY_ICONS[a.entity] ?? <ActivityIcon className="size-3.5" aria-hidden />;
}

async function RecentActivity() {
  const items = await listActivity(getDb(), 8);
  return (
    <Card title="Senaste aktivitet">
      {items.length === 0 ? (
        <EmptyState icon={<ActivityIcon className="size-5" />} title="Ingen aktivitet ännu">
          Transaktioner, bevakningar och anteckningar visas här i ett flöde.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-fill text-ink-muted">{activityIcon(a)}</span>
              <div className="min-w-0">
                {a.href ? <Link href={a.href} className="text-ink hover:underline">{a.summary}</Link> : <span className="text-ink">{a.summary}</span>}
                <div className="text-xs text-ink-subtle">{a.userName ?? "Okänd"} · {relativeTime(a.createdAt)}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const WIDGETS: Record<WidgetId, (props: WidgetProps) => ReactNode | Promise<ReactNode>> = {
  "watchlist-movers": WatchlistMovers,
  "active-analyses": ActiveAnalyses,
  activity: RecentActivity,
};

export function DashboardWidget({ widget, module, user }: { widget: WidgetId } & WidgetProps) {
  const Widget = WIDGETS[widget];
  return <Widget module={module} user={user} />;
}
