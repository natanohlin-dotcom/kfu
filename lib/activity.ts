/** Aktivitetsloggen (tabell activity_log): flödet på översikten och spårbarhet. */

export type ActivityEntity = "transaction" | "watchlist" | "benchmark";

export type ActivityInput = {
  userId: number;
  action: string;
  entity: ActivityEntity;
  entityId?: number | null;
  href?: string | null;
  summary: string;
};

export type Activity = {
  id: number;
  action: string;
  entity: ActivityEntity;
  href: string | null;
  summary: string;
  userName: string | null;
  createdAt: string;
};

/** Som statement, så att loggningen kan ligga i samma batch som ändringen. */
export function activityStatement(db: D1Database, a: ActivityInput): D1PreparedStatement {
  return db
    .prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, href, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(a.userId, a.action, a.entity, a.entityId ?? null, a.href ?? null, a.summary.slice(0, 300), new Date().toISOString());
}

/** Loggar utan att fälla anropet om loggningen misslyckas (loggen är sekundär). */
export async function logActivity(db: D1Database, a: ActivityInput): Promise<void> {
  try {
    await activityStatement(db, a).run();
  } catch (err) {
    console.error("Aktivitetsloggning misslyckades", err);
  }
}

export async function listActivity(db: D1Database, limit = 10): Promise<Activity[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.action, a.entity, a.href, a.summary, a.created_at, u.display_name
       FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: number; action: string; entity: ActivityEntity; href: string | null; summary: string; created_at: string; display_name: string | null }>();
  return results.map((r) => ({ id: r.id, action: r.action, entity: r.entity, href: r.href, summary: r.summary, userName: r.display_name, createdAt: r.created_at }));
}
