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

/** Kurs med två decimaler och valutakod: "263,45 DKK" (index utan valuta: "3 256,08") */
export function price(value: number | null | undefined, currency?: string | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const n = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return currency ? `${n} ${currency}` : n;
}

/** Stora belopp: 1,16e12 → "1 163 mdr DKK" */
export function bigAmount(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const f = (v: number, d: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: d }).format(v);
  const s = Math.abs(value) >= 1e9 ? `${f(value / 1e9, 1)} mdr` : Math.abs(value) >= 1e6 ? `${f(value / 1e6, 1)} mn` : f(value, 0);
  return currency ? `${s} ${currency}` : s;
}

export function shortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "–";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate.slice(0, 10)}T12:00:00Z`));
}

/** Tal med valfritt antal decimaler: 18.43 → "18,4" */
export function num(value: number | null | undefined, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Andel som procent utan tecken: 0.034 → "3,4 %" */
export function percent(fraction: number | null | undefined, digits = 1): string | null {
  if (fraction == null || !Number.isFinite(fraction)) return null;
  return new Intl.NumberFormat("sv-SE", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(fraction);
}

/** Antal (aktier, volym): 3,34e9 → "3,34 mdr", 1 250 000 → "1,25 mn" */
export function count(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = (v: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(v);
  if (Math.abs(value) >= 1e9) return `${f(value / 1e9)} mdr`;
  if (Math.abs(value) >= 1e6) return `${f(value / 1e6)} mn`;
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

/** Tolkar svenska tal från formulär: "1 234,56" → 1234.56. Tomt eller ogiltigt → null. */
export function parseNumber(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Signerat belopp i kronor: 1234.5 → "+1 235 kr" */
export function signedSek(value: number, digits = 0): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: digits, minimumFractionDigits: digits, signDisplay: "exceptZero" }).format(value);
}
