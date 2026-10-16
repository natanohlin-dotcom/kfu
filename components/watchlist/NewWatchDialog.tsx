"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { TickerSearch } from "@/components/market/TickerSearch";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { parseNumber } from "@/lib/format";
import type { SearchHit } from "@/lib/market/types";
import { STATUS_LABELS, type WatchStatus } from "@/lib/watchlist/status";
import { useWatchApi } from "./useWatchApi";

const START_STATUSES: WatchStatus[] = ["ide", "bevakning", "analys"];

/** "Inled bevakning": sök bolag, välj status, ansvarig, målkurs och skriv tesen direkt. */
export function NewWatchDialog({ users, currentUserId }: { users: { id: number; name: string }[]; currentUserId: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [status, setStatus] = useState<WatchStatus>("ide");
  const [ownerId, setOwnerId] = useState(String(currentUserId));
  const [target, setTarget] = useState("");
  const [thesis, setThesis] = useState("");
  const { call, pending, error, setError } = useWatchApi();

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) {
      d.showModal();
      // <dialog> fokuserar första knappen (stäng); sökfältet ska ha fokus
      requestAnimationFrame(() => d.querySelector<HTMLInputElement>("input")?.focus());
    }
    if (!open && d?.open) d.close();
  }, [open]);

  function close() {
    setOpen(false);
    setPicked(null);
    setTarget("");
    setThesis("");
    setStatus("ide");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    const created = await call<{ security: { symbol: string } }>("/api/watchlist", "POST", {
      symbol: picked.symbol,
      status,
      ownerId: ownerId ? Number(ownerId) : null,
      targetPrice: parseNumber(target),
      thesis: thesis.trim() || undefined,
    });
    if (created) {
      close();
      router.push(`/admin/bolag/${encodeURIComponent(created.security.symbol)}`);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Inled bevakning
      </Button>
      <dialog
        ref={ref}
        onClose={close}
        aria-labelledby="new-watch-title"
        className="m-0 mx-auto mt-[8vh] max-h-[84vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface p-6 text-ink shadow-pop backdrop:bg-ink/20 backdrop:backdrop-blur-[2px]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="new-watch-title" className="font-display text-[1.75rem] leading-tight font-medium">Inled bevakning</h2>
          <button type="button" onClick={close} className="rounded-sm p-1.5 text-ink-muted hover:bg-fill hover:text-ink" aria-label="Stäng">
            <X className="size-5" />
          </button>
        </div>

        {!picked ? (
          open && <TickerSearch autoFocus onSelect={setPicked} placeholder="Sök bolag eller ticker" />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-sm bg-fill px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate">{picked.name}</div>
                <div className="text-sm text-ink-muted">{picked.symbol}{picked.exchange ? ` · ${picked.exchange}` : ""}</div>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="rounded-sm p-1.5 text-ink-muted hover:bg-fill-hover hover:text-ink" aria-label="Byt bolag">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as WatchStatus)} options={START_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
              <Select label="Ansvarig" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={[{ value: "", label: "Ingen" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
            </div>
            <Field label="Målkurs (valfri)" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} hint="I bolagets handelsvaluta" />
            <TextArea label="Investeringstes (valfri)" value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} placeholder="Varför är bolaget intressant? Vad måste stämma?" />
            {error && <p role="alert" className="rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Sparar …" : "Inled bevakning"}</Button>
              <Button variant="ghost" onClick={close}>Avbryt</Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
