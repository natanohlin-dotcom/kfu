"use client";

import { Select } from "@/components/ui/Select";
import { STATUS_LABELS, WATCH_STATUSES, type WatchStatus } from "@/lib/watchlist/status";
import { useWatchApi } from "./useWatchApi";

/** Byt status direkt i listan eller på tavlan (tillgängligt alternativ till dra och släpp). */
export function StatusSelect({ id, status, name, disabled }: { id: number; status: WatchStatus; name: string; disabled?: boolean }) {
  const { call, pending, error } = useWatchApi();
  return (
    <div>
      <Select
        label={`Status för ${name}`}
        hideLabel
        dense
        value={status}
        disabled={disabled || pending}
        onChange={(e) => call(`/api/watchlist/${id}`, "PATCH", { status: e.target.value })}
        options={WATCH_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      {error && <p className="mt-1 text-xs text-down" role="alert">{error}</p>}
    </div>
  );
}
