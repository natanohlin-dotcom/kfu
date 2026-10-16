import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { NewWatchDialog } from "@/components/watchlist/NewWatchDialog";
import { StatusSelect } from "@/components/watchlist/StatusSelect";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { price, relativeTime, signedPercent } from "@/lib/format";
import { getMarket } from "@/lib/market";
import { listActiveUsers } from "@/lib/users";
import { listWatchItems } from "@/lib/watchlist/repo";
import { BOARD_COLUMNS, STATUS_LABELS, STATUS_TONES } from "@/lib/watchlist/status";
import { withQuotes, type WatchRow } from "@/lib/watchlist/view";

export const metadata: Metadata = { title: "Bevakningar" };

type Search = { vy?: string; agare?: string; arkiv?: string };

export default async function WatchlistPage({ searchParams }: PageProps<"/admin/bevakningar">) {
  const user = await requireUser("watchlist:read");
  const sp = (await searchParams) as Search;
  const view = sp.vy === "lista" ? "lista" : "tavla";
  const mine = sp.agare === "mina";
  const archived = sp.arkiv === "1" && view === "lista";

  const db = getDb();
  const [items, users] = await Promise.all([listWatchItems(db, { includeArchived: archived }), listActiveUsers()]);
  const filtered = mine ? items.filter((i) => i.owner?.id === user.id) : items;
  const rows = await withQuotes(filtered, getMarket(db));
  const canWrite = can(user, "watchlist:write");

  const link = (patch: Partial<Search>) => {
    const next = { vy: view, agare: mine ? "mina" : undefined, arkiv: archived ? "1" : undefined, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/admin/bevakningar${qs ? `?${qs}` : ""}`;
  };
  const pill = (active: boolean) => `flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm transition-colors ${active ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`;

  return (
    <div>
      <PageHeader
        title="Bevakningar"
        description="Bolag vi följer, från idé till beslut."
        actions={canWrite ? <NewWatchDialog users={users} currentUserId={user.id} /> : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Vy" className="flex rounded-sm bg-fill p-1">
          <Link href={link({ vy: "tavla", arkiv: undefined })} className={pill(view === "tavla")} aria-current={view === "tavla" ? "page" : undefined}>
            <LayoutGrid className="size-4" aria-hidden /> Tavla
          </Link>
          <Link href={link({ vy: "lista" })} className={pill(view === "lista")} aria-current={view === "lista" ? "page" : undefined}>
            <List className="size-4" aria-hidden /> Lista
          </Link>
        </nav>
        <nav aria-label="Ansvarig" className="flex rounded-sm bg-fill p-1">
          <Link href={link({ agare: undefined })} className={pill(!mine)} aria-current={!mine ? "page" : undefined}>Alla</Link>
          <Link href={link({ agare: "mina" })} className={pill(mine)} aria-current={mine ? "page" : undefined}>Mina</Link>
        </nav>
        {view === "lista" && (
          <Link href={link({ arkiv: archived ? undefined : "1" })} className={`rounded-sm px-3 py-2 text-sm ${archived ? "bg-fill-strong text-ink" : "text-ink-muted hover:bg-fill hover:text-ink"}`}>
            {archived ? "Dölj arkiverade" : "Visa arkiverade"}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title={mine ? "Du är inte ansvarig för någon bevakning" : "Inga bevakningar ännu"}>
            Inled en bevakning genom att söka efter ett bolag. Tes, triggers och målkurs skrivs sedan på bolagssidan.
          </EmptyState>
        </Card>
      ) : view === "tavla" ? (
        <Board rows={rows} canWrite={canWrite} />
      ) : (
        <ListView rows={rows} canWrite={canWrite} />
      )}
    </div>
  );
}

function Distance({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-subtle">–</span>;
  return <span className={value >= 0 ? "text-up" : "text-down"}>{signedPercent(value)}</span>;
}

function Board({ rows, canWrite }: { rows: WatchRow[]; canWrite: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-4">
      {BOARD_COLUMNS.map((col) => {
        const cards = rows.filter((r) => col.statuses.includes(r.status));
        return (
          <section key={col.id} aria-labelledby={`col-${col.id}`} className="flex flex-col rounded-lg bg-fill p-3">
            <header className="mb-3 flex items-baseline justify-between px-2 pt-1">
              <h2 id={`col-${col.id}`} className="text-ink">{col.label}</h2>
              <span className="tabular text-sm text-ink-muted">{cards.length}</span>
            </header>
            <p className="mb-3 px-2 text-xs text-ink-subtle">{col.hint}</p>
            <ul className="flex flex-col gap-2">
              {cards.map((r) => (
                <li key={r.id} className="rounded-md bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/bolag/${encodeURIComponent(r.security.symbol)}`} className="min-w-0 text-ink hover:underline">
                      <span className="block truncate">{r.security.name}</span>
                    </Link>
                    {col.statuses.length > 1 && <Badge tone={STATUS_TONES[r.status]}>{r.status === "kop" ? "Köp" : "Avstå"}</Badge>}
                  </div>
                  <div className="tabular mt-1 flex flex-wrap gap-x-3 text-sm">
                    <span className="text-ink-muted">{price(r.price, r.security.currency)}</span>
                    {r.changePercent != null && <span className={r.changePercent >= 0 ? "text-up" : "text-down"}>{signedPercent(r.changePercent, 2)}</span>}
                  </div>
                  {r.targetPrice != null && (
                    <div className="tabular mt-1 text-sm text-ink-muted">
                      Mål {price(r.targetPrice, null)} · <Distance value={r.distance} />
                    </div>
                  )}
                  {r.thesis && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{r.thesis}</p>}
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-subtle">
                    <span className="truncate">{r.owner ? r.owner.name : "Ingen ansvarig"}{r.noteCount ? ` · ${r.noteCount} ant.` : ""}</span>
                    <span>{relativeTime(r.updatedAt)}</span>
                  </div>
                  {canWrite && (
                    <div className="mt-3">
                      <StatusSelect id={r.id} status={r.status} name={r.security.name} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ListView({ rows, canWrite }: { rows: WatchRow[]; canWrite: boolean }) {
  return (
    <Card flush>
      <div className="overflow-x-auto p-6">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="pb-2 font-normal">Bolag</th>
              <th className="pb-2 font-normal">Status</th>
              <th className="pb-2 text-right font-normal">Kurs</th>
              <th className="pb-2 text-right font-normal">Idag</th>
              <th className="pb-2 text-right font-normal">Målkurs</th>
              <th className="pb-2 text-right font-normal">Till mål</th>
              <th className="pb-2 pl-4 font-normal">Ansvarig</th>
              <th className="pb-2 text-right font-normal">Uppdaterad</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-3 pr-3">
                  <Link href={`/admin/bolag/${encodeURIComponent(r.security.symbol)}`} className="text-ink hover:underline">{r.security.name}</Link>
                  <div className="text-xs text-ink-muted">{r.security.symbol}</div>
                </td>
                <td className="w-44 py-2 pr-3">
                  {canWrite ? <StatusSelect id={r.id} status={r.status} name={r.security.name} /> : <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>}
                </td>
                <td className="py-3 text-right text-ink">{price(r.price, r.security.currency)}</td>
                <td className={`py-3 text-right ${r.changePercent == null ? "text-ink-subtle" : r.changePercent >= 0 ? "text-up" : "text-down"}`}>{r.changePercent == null ? "–" : signedPercent(r.changePercent, 2)}</td>
                <td className="py-3 text-right text-ink">{r.targetPrice != null ? price(r.targetPrice, null) : "–"}</td>
                <td className="py-3 text-right"><Distance value={r.distance} /></td>
                <td className="py-3 pl-4 text-ink-muted">{r.owner?.name ?? "–"}</td>
                <td className="py-3 text-right text-ink-muted">{relativeTime(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
