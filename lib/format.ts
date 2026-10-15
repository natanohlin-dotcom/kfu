/** Talformat och datum på ett ställe (PLAN.md §10). Allt i svensk tid och svenskt format. */

export const TIME_ZONE = "Europe/Stockholm";

export function greeting(date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(date));
  if (hour < 5) return "God natt";
  if (hour < 10) return "God morgon";
  if (hour < 13) return "God förmiddag";
  if (hour < 18) return "God eftermiddag";
  return "God kväll";
}

export function longDate(date = new Date()): string {
  const s = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));
}

export function sek(value: number, digits = 0): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: digits }).format(value);
}

/** 0.084 → "+8,4 %" */
export function signedPercent(fraction: number, digits = 1): string {
  return new Intl.NumberFormat("sv-SE", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "exceptZero" }).format(fraction);
}
