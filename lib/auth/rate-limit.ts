import { getDb } from "@/lib/db";

/** Spärr mot lösenordsgissning, räknad i D1 (fungerar över alla isolat, mall §6). */

const MAX_FAILURES = 8;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

type Row = { key: string; failures: number; first_failure_at: string };

export async function isLocked(keys: string[]): Promise<boolean> {
  const placeholders = keys.map(() => "?").join(",");
  const { results } = await getDb()
    .prepare(`SELECT * FROM login_attempts WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<Row>();
  const now = Date.now();
  return results.some((r) => r.failures >= MAX_FAILURES && now - Date.parse(r.first_failure_at) < LOCK_WINDOW_MS);
}

export async function recordFailure(keys: string[]): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS).toISOString();
  const db = getDb();
  await db.batch(
    keys.map((key) =>
      db
        .prepare(
          "INSERT INTO login_attempts (key, failures, first_failure_at) VALUES (?, 1, ?) " +
            "ON CONFLICT(key) DO UPDATE SET " +
            "failures = CASE WHEN first_failure_at < ? THEN 1 ELSE failures + 1 END, " +
            "first_failure_at = CASE WHEN first_failure_at < ? THEN excluded.first_failure_at ELSE first_failure_at END",
        )
        .bind(key, now.toISOString(), windowStart, windowStart),
    ),
  );
}

export async function clearFailures(keys: string[]): Promise<void> {
  const placeholders = keys.map(() => "?").join(",");
  await getDb().prepare(`DELETE FROM login_attempts WHERE key IN (${placeholders})`).bind(...keys).run();
}
