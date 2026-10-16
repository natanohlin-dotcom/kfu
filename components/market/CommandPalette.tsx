"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { TickerSearch } from "./TickerSearch";

/** ⌘K / Ctrl+K: sök värdepapper och öppna bolagssidan. Inbyggd <dialog> (mall §9). */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === ref.current && onOpenChange(false)}
      aria-label="Sök värdepapper"
      className="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-lg bg-surface p-3 text-ink shadow-pop backdrop:bg-ink/20 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <TickerSearch
          autoFocus
          appearance="plain"
          onSelect={(hit) => {
            onOpenChange(false);
            router.push(`/admin/bolag/${encodeURIComponent(hit.symbol)}`);
          }}
        />
      )}
      <p className="mt-2 border-t border-line px-3 pt-2.5 text-xs text-ink-subtle">↑↓ för att välja · Enter öppnar · Esc stänger</p>
    </dialog>
  );
}
