import { isRole, type Role } from "./permissions";
import { sha256Hex } from "./password";

/**
 * Tillfälliga lösenord för första inloggningen, från hemligheten ADMIN_KEYS (mall §7):
 *   "Namn:användarnamn:roll:sha256(användarnamn:lösenord)", flera separerade med kommatecken.
 * Skapa en post med `node scripts/admin-key.mjs "Namn" användarnamn roll`.
 */

export type AdminKey = { displayName: string; username: string; role: Role; hash: string };

export function parseAdminKeys(raw: string | undefined): AdminKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [displayName, username, role, hash] = entry.split(":").map((s) => s.trim());
      if (!displayName || !username || !isRole(role) || !/^[0-9a-f]{64}$/.test(hash ?? "")) return [];
      return [{ displayName, username: username.toLowerCase(), role, hash }];
    });
}

/** Posten för användaren om lösenordet stämmer mot det tillfälliga, annars null. */
export async function matchAdminKey(keys: AdminKey[], username: string, password: string): Promise<AdminKey | null> {
  const key = keys.find((k) => k.username === username);
  if (!key) return null;
  return (await sha256Hex(`${username}:${password}`)) === key.hash ? key : null;
}
