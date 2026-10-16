"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { TickerSearch } from "@/components/market/TickerSearch";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { readApiResult } from "@/lib/api";
import { BENCHMARK_COLORS, colorDotClass, nextColor, type Benchmark, type BenchmarkColor } from "@/lib/benchmarks";
import { dateTime, price, shortDate, signedPercent } from "@/lib/format";
import type { PriceUpdateResult } from "@/lib/market/prices";
import type { SearchHit } from "@/lib/market/types";

type Props = { initial: Benchmark[]; canEdit: boolean; lastRun: PriceUpdateResult | null };

export function BenchmarkManager({ initial, canEdit, lastRun: initialRun }: Props) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Kör ett anrop som returnerar hela den uppdaterade listan. */
  async function mutate(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).catch(() => null);
    const result = res ? await readApiResult<Benchmark[]>(res) : null;
    setBusy(false);
    if (!res?.ok || !result?.success || !result.data) {
      setError(result?.error ?? "Något gick fel. Försök igen.");
      return false;
    }
    setItems(result.data);
    return true;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
      <Card title="Jämförelseindex" description="Portföljen jämförs mot dessa i översiktens graf. Standardindexet används i nyckeltalen.">
        {error && (
          <p role="alert" className="mb-4 rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">
            {error}
          </p>
        )}
        {items.length === 0 ? (
          <p className="py-6 text-center text-ink-muted">Inga jämförelseindex ännu.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((b) => (
              <BenchmarkRow key={b.id} b={b} canEdit={canEdit} busy={busy} mutate={mutate} />
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-4 lg:gap-5">
        {canEdit && <AddBenchmark used={items.map((b) => b.color)} existing={items.map((b) => b.security.symbol)} busy={busy} mutate={mutate} />}
        <PriceUpdate initial={initialRun} canEdit={canEdit} />
      </div>
    </div>
  );
}

type Mutate = (url: string, init: RequestInit) => Promise<boolean>;

function BenchmarkRow({ b, canEdit, busy, mutate }: { b: Benchmark; canEdit: boolean; busy: boolean; mutate: Mutate }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [label, setLabel] = useState(b.label);
  const [color, setColor] = useState<BenchmarkColor>(b.color);

  if (mode === "edit") {
    return (
      <li className="rounded-md bg-fill p-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await mutate(`/api/benchmarks/${b.id}`, { method: "PATCH", body: JSON.stringify({ label, color }) })) setMode("view");
          }}
        >
          <Field label="Namn i grafen" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} required />
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !label.trim()}>Spara</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode("view"); setLabel(b.label); setColor(b.color); }}>Avbryt</Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-fill px-4 py-3.5">
      <span className={`size-2.5 shrink-0 rounded-full ${colorDotClass(b.color)}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/bolag/${encodeURIComponent(b.security.symbol)}`} className="text-ink hover:underline">{b.label}</Link>
          {b.isDefault && <Badge tone="accent">Standard</Badge>}
        </div>
        <div className="truncate text-sm text-ink-muted">{b.security.symbol} · {b.security.name}</div>
      </div>
      <div className="tabular text-right text-sm">
        <div className="text-ink">{price(b.lastClose, null)}</div>
        <div className={b.ytd == null ? "text-ink-subtle" : b.ytd >= 0 ? "text-up" : "text-down"}>
          {b.ytd == null ? "ingen kurs ännu" : `${signedPercent(b.ytd)} i år`}
        </div>
      </div>
      {canEdit && (
        <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
          {mode === "confirm-delete" ? (
            <>
              <span className="mr-1 text-sm text-ink-muted">Ta bort?</span>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => mutate(`/api/benchmarks/${b.id}`, { method: "DELETE" })}>Ta bort</Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Avbryt</Button>
            </>
          ) : (
            <>
              {!b.isDefault && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => mutate(`/api/benchmarks/${b.id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) })}>
                  Gör till standard
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label={`Redigera ${b.label}`} onClick={() => setMode("edit")}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Ta bort ${b.label}`} onClick={() => setMode("confirm-delete")}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: BenchmarkColor; onChange: (c: BenchmarkColor) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm text-ink">Färg</legend>
      <div className="flex gap-2">
        {BENCHMARK_COLORS.map((c) => (
          <label key={c.token} className="cursor-pointer">
            <input type="radio" name="color" value={c.token} checked={value === c.token} onChange={() => onChange(c.token)} className="peer sr-only" />
            <span className="flex items-center gap-2 rounded-sm bg-surface px-3 py-1.5 text-sm text-ink-muted ring-accent peer-checked:text-ink peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden />
              {c.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AddBenchmark({ used, existing, busy, mutate }: { used: string[]; existing: string[]; busy: boolean; mutate: Mutate }) {
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<BenchmarkColor>(nextColor(used));
  const [searchKey, setSearchKey] = useState(0);

  function reset() {
    setPicked(null);
    setLabel("");
    setSearchKey((k) => k + 1);
  }

  return (
    <Card title="Lägg till index" description="Sök efter ett index, en ETF eller en fond.">
      {!picked ? (
        <TickerSearch
          key={searchKey}
          placeholder="T.ex. OMXSPI, S&P 500, XACT"
          onSelect={(hit) => {
            setPicked(hit);
            setLabel(hit.name.slice(0, 40));
            setColor(nextColor(used));
          }}
        />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await mutate("/api/benchmarks", { method: "POST", body: JSON.stringify({ symbol: picked.symbol, label, color }) })) reset();
          }}
        >
          <div className="rounded-md bg-fill px-4 py-3">
            <div className="text-ink">{picked.name}</div>
            <div className="text-sm text-ink-muted">{picked.symbol}{picked.exchange ? ` · ${picked.exchange}` : ""}</div>
            {existing.includes(picked.symbol) && <p className="mt-1 text-sm text-warn">Finns redan som jämförelseindex.</p>}
          </div>
          <Field label="Namn i grafen" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} required hint="Kort, t.ex. OMXS30" />
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !label.trim() || existing.includes(picked.symbol)}>
              {busy ? "Lägger till …" : "Lägg till"}
            </Button>
            <Button variant="ghost" onClick={reset}>Avbryt</Button>
          </div>
          {busy && <p className="text-sm text-ink-muted">Hämtar tio års kurshistorik …</p>}
        </form>
      )}
    </Card>
  );
}

function PriceUpdate({ initial, canEdit }: { initial: PriceUpdateResult | null; canEdit: boolean }) {
  const [run, setRun] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/market/refresh", { method: "POST" }).catch(() => null);
    const result = res ? await readApiResult<PriceUpdateResult>(res) : null;
    setPending(false);
    if (!res?.ok || !result?.success || !result.data) {
      setError(result?.error ?? "Uppdateringen misslyckades");
      return;
    }
    setRun(result.data);
  }

  return (
    <Card tone="fill" title="Kursuppdatering" description="Körs automatiskt vardagar efter Stockholmsbörsens stängning.">
      {run ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-muted">Senast</dt>
          <dd className="tabular">{dateTime(run.ranAt)}</dd>
          <dt className="text-ink-muted">Uppdaterade</dt>
          <dd>{run.updated.length} värdepapper</dd>
          {run.failed.length > 0 && (
            <>
              <dt className="text-down">Fel</dt>
              <dd className="text-down">{run.failed.map((f) => f.symbol).join(", ")}</dd>
            </>
          )}
          {run.remaining > 0 && (
            <>
              <dt className="text-ink-muted">Kvar</dt>
              <dd>{run.remaining} tas nästa körning</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">Ingen uppdatering har körts ännu ({shortDate(new Date().toISOString())}).</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
      {canEdit && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={refresh} disabled={pending}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
          {pending ? "Uppdaterar …" : "Uppdatera nu"}
        </Button>
      )}
    </Card>
  );
}
