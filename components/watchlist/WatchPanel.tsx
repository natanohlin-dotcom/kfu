"use client";

import { useState, type FormEvent } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { parseNumber, price, relativeTime, signedPercent } from "@/lib/format";
import type { WatchItem, WatchNote } from "@/lib/watchlist/repo";
import { STATUS_LABELS, STATUS_TONES, targetDistance, WATCH_STATUSES } from "@/lib/watchlist/status";
import { useWatchApi } from "./useWatchApi";

type Props = {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number | null;
  item: WatchItem | null;
  notes: WatchNote[];
  users: { id: number; name: string }[];
  canWrite: boolean;
};

/** Bevakningen på bolagssidan (PLAN.md §7): status, ansvarig, målkurs, tes, triggers och anteckningar. */
export function WatchPanel(props: Props) {
  if (!props.item || props.item.status === "arkiverad") return <StartWatch {...props} />;
  return <ActiveWatch {...props} item={props.item} />;
}

function StartWatch({ symbol, name, item, canWrite }: Props) {
  const { call, pending, error } = useWatchApi();
  return (
    <Card tone="fill" className="mt-4 lg:mt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-muted"><Eye className="size-5" aria-hidden /></span>
          <div>
            <div className="text-ink">{item ? "Bevakningen är arkiverad" : "Bevakas inte"}</div>
            <div className="text-sm text-ink-muted">Följ bolaget med tes, triggers och målkurs.</div>
          </div>
        </div>
        {canWrite && (
          <Button variant="secondary" disabled={pending} onClick={() => call("/api/watchlist", "POST", { symbol, status: "bevakning" })}>
            {item ? "Återuppta bevakning" : `Inled bevakning av ${name.length > 24 ? "bolaget" : name}`}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
    </Card>
  );
}

function ActiveWatch({ item, notes, users, currency, currentPrice, canWrite }: Props & { item: WatchItem }) {
  const { call, pending, error } = useWatchApi();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const distance = targetDistance(currentPrice, item.targetPrice);
  const url = `/api/watchlist/${item.id}`;

  return (
    <Card
      className="mt-4 lg:mt-5"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Bevakning <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
        </span>
      }
      description={`Inledd ${relativeTime(item.createdAt)}${item.createdBy ? ` av ${item.createdBy}` : ""} · uppdaterad ${relativeTime(item.updatedAt)}`}
      action={
        canWrite ? (
          confirmDelete ? (
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => call(url, "PATCH", { status: "arkiverad" })} disabled={pending}>Arkivera</Button>
              <Button size="sm" variant="danger" onClick={() => call(url, "DELETE")} disabled={pending}>Ta bort helt</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Avbryt</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Avsluta bevakningen">
              <Trash2 className="size-4" aria-hidden /> Avsluta
            </Button>
          )
        ) : undefined
      }
    >
      {error && <p role="alert" className="mb-4 rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <div className="flex flex-col gap-6">
          <EditableText label="Investeringstes" value={item.thesis} placeholder="Varför är bolaget intressant? Vad måste stämma för att det ska bli en bra investering?" canWrite={canWrite} onSave={(v) => call(url, "PATCH", { thesis: v })} />
          <EditableText label="Triggers" value={item.triggers} placeholder="Vad ska få oss att agera? T.ex. rapport, kursnivå, ledningsbyte." canWrite={canWrite} onSave={(v) => call(url, "PATCH", { triggers: v })} />
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={item.status}
              disabled={!canWrite || pending}
              onChange={(e) => call(url, "PATCH", { status: e.target.value })}
              options={WATCH_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <Select
              label="Ansvarig"
              value={item.owner ? String(item.owner.id) : ""}
              disabled={!canWrite || pending}
              onChange={(e) => call(url, "PATCH", { ownerId: e.target.value ? Number(e.target.value) : null })}
              options={[{ value: "", label: "Ingen" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
            />
          </div>
          <TargetPrice key={item.targetPrice ?? "none"} value={item.targetPrice} currency={currency} distance={distance} canWrite={canWrite} pending={pending} onSave={(v) => call(url, "PATCH", { targetPrice: v })} />
        </div>
      </div>

      <Notes itemId={item.id} notes={notes} canWrite={canWrite} />
    </Card>
  );
}

function EditableText({ label, value, placeholder, canWrite, onSave }: { label: string; value: string | null; placeholder: string; canWrite: boolean; onSave: (v: string | null) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <form
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          setSaving(true);
          const ok = await onSave(draft.trim() || null);
          setSaving(false);
          if (ok) setEditing(false);
        }}
        className="flex flex-col gap-2"
      >
        <TextArea label={label} value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} placeholder={placeholder} autoFocus />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Sparar …" : "Spara"}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value ?? ""); setEditing(false); }}>Avbryt</Button>
        </div>
      </form>
    );
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm text-ink-muted">{label}</h3>
        {canWrite && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Redigera ${label.toLowerCase()}`}>
            <Pencil className="size-3.5" aria-hidden /> {value ? "Redigera" : "Skriv"}
          </Button>
        )}
      </div>
      {value ? <p className="whitespace-pre-line text-ink">{value}</p> : <p className="text-ink-subtle">Inte skriven ännu.</p>}
    </div>
  );
}

function TargetPrice({ value, currency, distance, canWrite, pending, onSave }: { value: number | null; currency: string; distance: number | null; canWrite: boolean; pending: boolean; onSave: (v: number | null) => Promise<unknown> }) {
  const [draft, setDraft] = useState(value != null ? String(value).replace(".", ",") : "");
  const parsed = parseNumber(draft);
  const changed = parsed !== value && !(draft.trim() === "" && value === null);
  return (
    <div className="rounded-md bg-fill p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-muted">Målkurs</span>
        {distance != null && (
          <span className={`tabular text-sm ${distance >= 0 ? "text-up" : "text-down"}`}>
            {signedPercent(distance)} {distance >= 0 ? "uppsida" : "över målet"}
          </span>
        )}
      </div>
      {canWrite ? (
        <form
          className="mt-2 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() && (parsed === null || parsed <= 0)) return;
            onSave(draft.trim() ? parsed : null);
          }}
        >
          <Field label={`Målkurs i ${currency}`} className="flex-1 [&>label]:sr-only" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ingen målkurs" />
          {changed && <Button type="submit" size="sm" disabled={pending} className="mb-1.5">Spara</Button>}
        </form>
      ) : (
        <div className="tabular mt-1 text-xl text-ink">{value != null ? price(value, currency) : "–"}</div>
      )}
    </div>
  );
}

function Notes({ itemId, notes, canWrite }: { itemId: number; notes: WatchNote[]; canWrite: boolean }) {
  const [body, setBody] = useState("");
  const { call, pending, error } = useWatchApi();
  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="mb-3 text-ink">Anteckningar</h3>
      {canWrite && (
        <form
          className="mb-5 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            if (await call(`/api/watchlist/${itemId}/notes`, "POST", { body })) setBody("");
          }}
        >
          <TextArea label="Ny anteckning" hideLabel value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Nyheter, mötesbeslut, frågor till nästa möte …" />
          {error && <p className="text-sm text-down" role="alert">{error}</p>}
          <Button type="submit" size="sm" variant="secondary" disabled={pending || !body.trim()} className="self-start">Lägg till</Button>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-ink-subtle">Inga anteckningar ännu.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <div className="text-xs text-ink-subtle">{n.userName ?? "Okänd"} · {relativeTime(n.createdAt)}</div>
              <p className="mt-0.5 whitespace-pre-line text-ink">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
