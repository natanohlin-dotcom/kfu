import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Läser en hemlighet/variabel vid anrop (aldrig vid import) och kastar tydligt fel om den saknas (mall §8). */
export function requireEnv(name: string): string {
  const fromCf = (getCloudflareContext().env as unknown as Record<string, unknown>)[name];
  const value = typeof fromCf === "string" ? fromCf : process.env[name];
  if (!value) throw new Error(`Miljövariabeln ${name} saknas`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  try {
    return requireEnv(name);
  } catch {
    return undefined;
  }
}
