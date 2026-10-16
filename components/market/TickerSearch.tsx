"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { readApiResult } from "@/lib/api";
import { KIND_LABELS, type SearchHit } from "@/lib/market/types";

type Props = {
  onSelect: (hit: SearchHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Etikett för skärmläsare (fältet har ingen synlig etikett i paletten) */
  label?: string;
  /** "plain" = utan bakgrund (i paletten), "field" = som andra fält */
  appearance?: "plain" | "field";
};

/** Sökfält med förslag (combobox-mönster): pilar, Enter och Escape. Söker mot /api/securities/search. */
export function TickerSearch({ onSelect, placeholder = "Sök bolag, index eller ticker", autoFocus, label = "Sök värdepapper", appearance = "field" }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const listId = useId();
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      setStatus("loading");
      const res = await fetch(`/api/securities/search?q=${encodeURIComponent(q)}`).catch(() => null);
      if (ticket !== latest.current) return;
      const result = res ? await readApiResult<SearchHit[]>(res) : null;
      if (!res?.ok || !result?.success) {
        setStatus("error");
        setHits([]);
        return;
      }
      setHits(result.data ?? []);
      setActive(0);
      setStatus("idle");
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const shown = query.trim() ? hits : [];

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault();
      onSelect(shown[active]);
    }
  }

  return (
    <div className="relative">
      <div className={`flex items-center gap-3 rounded-sm px-3.5 ${appearance === "field" ? "bg-fill focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent" : ""}`}>
        {status === "loading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-ink-subtle" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        )}
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-h-11 w-full bg-transparent py-2 text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      <ul id={listId} role="listbox" aria-label="Sökträffar" className={shown.length ? "mt-2 flex flex-col gap-0.5" : "hidden"}>
        {shown.map((h, i) => (
          <li
            key={h.symbol}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(h)}
            className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 ${i === active ? "bg-fill" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-ink">{h.name}</div>
              <div className="truncate text-sm text-ink-muted">
                {h.symbol}
                {h.exchange ? ` · ${h.exchange}` : ""}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-xs text-ink-muted">{KIND_LABELS[h.kind]}</span>
          </li>
        ))}
      </ul>
      {query.trim() && status === "idle" && hits.length === 0 && <p className="mt-3 px-3 text-sm text-ink-muted">Inga träffar.</p>}
      {status === "error" && <p className="mt-3 px-3 text-sm text-down">Sökningen fungerar inte just nu. Försök igen om en stund.</p>}
    </div>
  );
}
