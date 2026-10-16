"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiResult } from "@/lib/api";

/** Anrop mot /api/watchlist med felhantering och uppdatering av serverkomponenterna efteråt. */
export function useWatchApi() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T | null> {
    setPending(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const result = res ? await readApiResult<T>(res) : null;
    setPending(false);
    if (!res?.ok || !result?.success) {
      setError(result?.error ?? "Något gick fel. Försök igen.");
      return null;
    }
    router.refresh();
    return (result.data ?? (true as unknown)) as T;
  }

  return { call, pending, error, setError };
}
