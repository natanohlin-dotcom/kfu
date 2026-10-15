/**
 * Lösenordshashning med PBKDF2 (Web Crypto, fungerar i Workers och Node).
 * Antalet iterationer sparas i hashen så att det kan höjas utan att gamla hashar slutar fungera.
 * ~20 000 ryms inom Workers gratisnivås CPU-gräns (mall §7).
 */

export const PBKDF2_ITERATIONS = 20_000;
const PREFIX = "pbkdf2-sha256";

const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Jämförelse i konstant tid (undviker att svarstiden avslöjar hur många tecken som stämde). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `${PREFIX}$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (prefix !== PREFIX || !Number.isInteger(iterations) || !salt || !hash) return false;
  const actual = await derive(password, fromB64(salt), iterations);
  return timingSafeEqual(actual, fromB64(hash));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 10, label: "Minst 10 tecken" },
  { test: (p: string) => /[a-zåäö]/.test(p), label: "En liten bokstav" },
  { test: (p: string) => /[A-ZÅÄÖ]/.test(p), label: "En stor bokstav" },
  { test: (p: string) => /\d/.test(p), label: "En siffra" },
] as const;

/** Returnerar de krav som inte uppfylls (tom lista = godkänt). */
export function passwordProblems(password: string): string[] {
  const problems: string[] = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
  if (password.length > 200) problems.push("Högst 200 tecken");
  return problems;
}
