"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { readApiResult } from "@/lib/api";

export function DeleteTransactionButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    const res = await fetch(`/api/portfolio/transactions/${id}`, { method: "DELETE" }).catch(() => null);
    const result = res ? await readApiResult(res) : null;
    setPending(false);
    if (!res?.ok || !result?.success) {
      setError(result?.error ?? "Kunde inte ta bort");
      setConfirm(false);
      return;
    }
    router.refresh();
  }

  if (error) {
    return (
      <span className="flex items-center justify-end gap-2 text-sm text-down" role="alert">
        {error}
        <button type="button" className="text-ink-muted hover:text-ink" onClick={() => setError(null)} aria-label="Stäng">✕</button>
      </span>
    );
  }
  if (confirm) {
    return (
      <span className="flex items-center justify-end gap-1">
        <Button size="sm" variant="danger" onClick={remove} disabled={pending}>Ta bort</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Avbryt</Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" aria-label={`Ta bort ${label}`} onClick={() => setConfirm(true)}>
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
