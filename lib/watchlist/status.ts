/** Bevakningarnas statusar (PLAN.md §7): idé → bevakning → analys → beslut. Bara id:t sparas i databasen. */

export const WATCH_STATUSES = ["ide", "bevakning", "analys", "kop", "avsta", "arkiverad"] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const STATUS_LABELS: Record<WatchStatus, string> = {
  ide: "Idé",
  bevakning: "Bevakning",
  analys: "Under analys",
  kop: "Beslut: köp",
  avsta: "Beslut: avstå",
  arkiverad: "Arkiverad",
};

export const STATUS_TONES: Record<WatchStatus, "neutral" | "accent" | "warn" | "up" | "down"> = {
  ide: "neutral",
  bevakning: "accent",
  analys: "warn",
  kop: "up",
  avsta: "down",
  arkiverad: "neutral",
};

/** Kolumnerna på tavlan. Besluten delar kolumn; arkiverade visas inte. */
export const BOARD_COLUMNS: { id: string; label: string; statuses: WatchStatus[]; hint: string }[] = [
  { id: "ide", label: "Idé", statuses: ["ide"], hint: "Förslag som ingen tittat närmare på än" },
  { id: "bevakning", label: "Bevakning", statuses: ["bevakning"], hint: "Följs med tes och triggers" },
  { id: "analys", label: "Under analys", statuses: ["analys"], hint: "Analys eller DCF pågår" },
  { id: "beslut", label: "Beslut", statuses: ["kop", "avsta"], hint: "Beslutat i utskottet" },
];

export function isWatchStatus(v: unknown): v is WatchStatus {
  return typeof v === "string" && (WATCH_STATUSES as readonly string[]).includes(v);
}

/** Avstånd från kurs till målkurs som andel: positivt = uppsida kvar. */
export function targetDistance(price: number | null | undefined, target: number | null | undefined): number | null {
  return price && target ? target / price - 1 : null;
}
