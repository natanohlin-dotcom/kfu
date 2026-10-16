"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { TickerSearch } from "@/components/market/TickerSearch";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { readApiResult } from "@/lib/api";
import { parseNumber, price } from "@/lib/format";
import type { Quote, SearchHit } from "@/lib/market/types";
import { TYPE_LABELS, type TransactionType } from "@/lib/portfolio/types";

/** Ny transaktion (fas 3). Kassapåverkan och valutakurs räknas på servern; här visas en förhandsräkning. */

const ORDER: TransactionType[] = ["deposit", "buy", "sell", "dividend", "withdrawal", "fee"];
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

type Picked = SearchHit & { currency: string | null };

export function TransactionForm() {
  const router = useRouter();
  const [type, setType] = useState<TransactionType>("deposit");
  const [tradeDate, setTradeDate] = useState(today);
  const [security, setSecurity] = useState<Picked | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const needsSecurity = type === "buy" || type === "sell" || type === "dividend";
  const isTrade = type === "buy" || type === "sell";
  const ccy = security?.currency ?? null;
  const foreign = needsSecurity && ccy !== null && ccy !== "SEK";
  const q = parseNumber(quantity);
  const p = parseNumber(unitPrice);
  const gross = isTrade && q && p ? q * p : null;

  async function pick(hit: SearchHit) {
    setSecurity({ ...hit, currency: null });
    setErrors({});
    const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(hit.symbol)}`).catch(() => null);
    const result = res ? await readApiResult<Quote[]>(res) : null;
    const quote = result?.data?.[0];
    setSecurity({ ...hit, currency: quote?.currency ?? null });
    if (quote && !unitPrice) setUnitPrice(String(quote.price).replace(".", ","));
  }

  function reset() {
    setSecurity(null);
    setQuantity("");
    setUnitPrice("");
    setAmount("");
    setFees("");
    setFxRate("");
    setNote("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (needsSecurity && !security) local.symbol = "Välj ett värdepapper";
    if (isTrade && !q) local.quantity = "Ange antal";
    if (isTrade && !p) local.price = "Ange kurs";
    if (!isTrade && !parseNumber(amount)) local.amount = "Ange belopp";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const body = {
      type,
      tradeDate,
      note: note.trim() || undefined,
      ...(needsSecurity ? { symbol: security!.symbol } : {}),
      ...(isTrade ? { quantity: q, price: p, fees: parseNumber(fees) ?? 0 } : { amount: parseNumber(amount) }),
      ...(foreign && parseNumber(fxRate) ? { fxRate: parseNumber(fxRate) } : {}),
    };
    setPending(true);
    setErrors({});
    setSaved(null);
    const res = await fetch("/api/portfolio/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const result = res ? await readApiResult(res) : null;
    setPending(false);
    if (!res?.ok || !result?.success) {
      const field = result?.field ?? "form";
      setErrors({ [field === "amount" || field === "quantity" || field === "price" || field === "symbol" || field === "tradeDate" || field === "fxRate" ? field : "form"]: result?.error ?? "Kunde inte spara" });
      return;
    }
    setSaved(`${TYPE_LABELS[type]} sparad.`);
    reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-3 gap-1 rounded-sm bg-fill p-1" role="radiogroup" aria-label="Typ av transaktion">
        {ORDER.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === type}
            onClick={() => {
              setType(t);
              setErrors({});
              setSaved(null);
            }}
            className={`rounded-[7px] px-2 py-1.5 text-sm transition-colors ${t === type ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <Field label="Affärsdag" type="date" value={tradeDate} max={today()} onChange={(e) => setTradeDate(e.target.value)} error={errors.tradeDate} required />

      {needsSecurity && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink">Värdepapper</span>
          {security ? (
            <div className="flex items-center gap-3 rounded-sm bg-fill px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-ink">{security.name}</div>
                <div className="text-sm text-ink-muted">
                  {security.symbol}
                  {security.currency ? ` · handlas i ${security.currency}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSecurity(null)} className="rounded-sm p-1.5 text-ink-muted hover:bg-fill-hover hover:text-ink" aria-label="Byt värdepapper">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <TickerSearch onSelect={pick} placeholder="Sök aktie, ETF eller fond" />
          )}
          {errors.symbol && <p className="text-sm text-down">{errors.symbol}</p>}
        </div>
      )}

      {isTrade ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Antal" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
          <Field label={`Kurs${ccy ? ` (${ccy})` : ""}`} inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} error={errors.price} />
          <Field label="Courtage (SEK)" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
        </div>
      ) : (
        <Field
          label={type === "dividend" ? `Utdelning totalt${ccy ? ` (${ccy})` : ""}` : "Belopp (SEK)"}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          hint={type === "dividend" ? "Det som betalades ut till portföljen, före eventuell källskatt" : undefined}
        />
      )}

      {foreign && (
        <Field
          label={`Valutakurs ${ccy}/SEK`}
          inputMode="decimal"
          value={fxRate}
          onChange={(e) => setFxRate(e.target.value)}
          error={errors.fxRate}
          placeholder="Hämtas automatiskt för affärsdagen"
          hint="Lämna tomt för att använda dagens referenskurs från kurshistoriken."
        />
      )}

      <Field label="Anteckning (valfri)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

      {gross !== null && (
        <p className="rounded-sm bg-fill px-3.5 py-2.5 text-sm text-ink-muted">
          Belopp: <span className="tabular text-ink">{price(gross, ccy ?? undefined)}</span>
          {parseNumber(fees) ? <> + courtage <span className="tabular text-ink">{price(parseNumber(fees), "SEK")}</span></> : null}
          {foreign && <> · omräknas till SEK vid sparande</>}
        </p>
      )}

      {errors.form && (
        <p role="alert" className="rounded-sm bg-down-soft px-3.5 py-2.5 text-sm text-down">{errors.form}</p>
      )}
      {saved && (
        <p role="status" className="rounded-sm bg-up-soft px-3.5 py-2.5 text-sm text-up">{saved}</p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sparar …" : `Spara ${TYPE_LABELS[type].toLowerCase()}`}
      </Button>
    </form>
  );
}
