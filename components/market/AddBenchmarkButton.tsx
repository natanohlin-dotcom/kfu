"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { readApiResult } from "@/lib/api";

/** Lägger till värdepappret som jämförelseindex direkt från bolagssidan. */
export function AddBenchmarkButton({ symbol, label }: { symbol: string; label: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setState("saving");
    const res = await fetch("/api/benchmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, label }),
    }).catch(() => null);
    const result = res ? await readApiResult(res) : null;
    if (!res?.ok || !result?.success) {
      setError(result?.error ?? "Kunde inte lägga till");
      setState("error");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <Link href="/admin/installningar/jamforelseindex" className={buttonStyles({ variant: "secondary" })}>
        <Check className="size-4" aria-hidden /> Tillagt som jämförelseindex
      </Link>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={add} disabled={state === "saving"}>
        <Plus className="size-4" aria-hidden /> {state === "saving" ? "Lägger till …" : "Använd som jämförelseindex"}
      </Button>
      {error && <p className="text-sm text-down" role="alert">{error}</p>}
    </div>
  );
}
