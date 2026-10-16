import { activityStatement } from "@/lib/activity";
import type { MarketDataProvider, SecurityKind } from "@/lib/market/types";
import { normalizeSymbol } from "@/lib/market/types";
import { ensureSecurity } from "@/lib/securities";
import { STATUS_LABELS, type WatchStatus } from "./status";

/** Bevakningar i D1 (watchlist_items, watchlist_notes). Varje ändring loggas i samma batch. */

type ItemRow = {
  id: number;
  security_id: number;
  symbol: string;
  name: string;
  kind: SecurityKind;
  currency: string;
  status: WatchStatus;
  thesis: string | null;
  triggers: string | null;
  target_price: number | null;
  owner_id: number | null;
  owner_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  status_changed_at: string;
  note_count: number;
};

export type WatchItem = {
  id: number;
  security: { id: number; symbol: string; name: string; kind: SecurityKind; currency: string };
  status: WatchStatus;
  thesis: string | null;
  triggers: string | null;
  targetPrice: number | null;
  owner: { id: number; name: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
  noteCount: number;
};

export type WatchNote = { id: number; body: string; userName: string | null; createdAt: string };

function rowToItem(r: ItemRow): WatchItem {
  return {
    id: r.id,
    security: { id: r.security_id, symbol: r.symbol, name: r.name, kind: r.kind, currency: r.currency },
    status: r.status,
    thesis: r.thesis,
    triggers: r.triggers,
    targetPrice: r.target_price,
    owner: r.owner_id ? { id: r.owner_id, name: r.owner_name ?? "Okänd" } : null,
    createdBy: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    statusChangedAt: r.status_changed_at,
    noteCount: r.note_count,
  };
}

const SELECT = `SELECT w.*, s.symbol, s.name, s.kind, s.currency, o.display_name AS owner_name, c.display_name AS created_by_name,
    (SELECT COUNT(*) FROM watchlist_notes n WHERE n.item_id = w.id) AS note_count
  FROM watchlist_items w
  JOIN securities s ON s.id = w.security_id
  LEFT JOIN users o ON o.id = w.owner_id
  LEFT JOIN users c ON c.id = w.created_by`;

export async function listWatchItems(db: D1Database, opts: { includeArchived?: boolean } = {}): Promise<WatchItem[]> {
  const where = opts.includeArchived ? "" : "WHERE w.status != 'arkiverad'";
  const { results } = await db.prepare(`${SELECT} ${where} ORDER BY w.updated_at DESC`).all<ItemRow>();
  return results.map(rowToItem);
}

export async function getWatchItem(db: D1Database, id: number): Promise<WatchItem | null> {
  const row = await db.prepare(`${SELECT} WHERE w.id = ?`).bind(id).first<ItemRow>();
  return row ? rowToItem(row) : null;
}

export async function getWatchItemBySymbol(db: D1Database, symbol: string): Promise<WatchItem | null> {
  const row = await db.prepare(`${SELECT} WHERE s.symbol = ?`).bind(symbol).first<ItemRow>();
  return row ? rowToItem(row) : null;
}

export class WatchError extends Error {
  constructor(message: string, readonly status = 400, readonly field?: string) {
    super(message);
  }
}

const href = (symbol: string) => `/admin/bolag/${encodeURIComponent(symbol)}`;

export type NewWatchItem = { symbol: string; status?: WatchStatus; thesis?: string; triggers?: string; targetPrice?: number | null; ownerId?: number | null };

/** Inleder en bevakning. Finns en arkiverad för samma bolag återupptas den i stället. */
export async function createWatchItem(db: D1Database, market: MarketDataProvider, input: NewWatchItem, userId: number): Promise<WatchItem> {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) throw new WatchError("Ogiltig symbol", 400, "symbol");
  const security = await ensureSecurity(db, market, symbol);
  if (security.kind === "fx") throw new WatchError("Valutor kan inte bevakas", 400, "symbol");

  const existing = await getWatchItemBySymbol(db, symbol);
  const now = new Date().toISOString();
  const status = input.status ?? "ide";
  if (existing && existing.status !== "arkiverad") throw new WatchError(`${security.name} bevakas redan (${STATUS_LABELS[existing.status].toLowerCase()})`, 409);

  if (existing) {
    await db.batch([
      db.prepare("UPDATE watchlist_items SET status = ?, updated_at = ?, status_changed_at = ? WHERE id = ?").bind(status, now, now, existing.id),
      activityStatement(db, { userId, action: "watchlist.reopened", entity: "watchlist", entityId: existing.id, href: href(symbol), summary: `Återupptog bevakningen av ${security.name}` }),
    ]);
    return (await getWatchItem(db, existing.id))!;
  }

  const row = await db
    .prepare(
      `INSERT INTO watchlist_items (security_id, status, thesis, triggers, target_price, owner_id, created_by, created_at, updated_at, status_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(security.id, status, input.thesis || null, input.triggers || null, input.targetPrice ?? null, input.ownerId ?? userId, userId, now, now, now)
    .first<{ id: number }>();
  await activityStatement(db, { userId, action: "watchlist.created", entity: "watchlist", entityId: row!.id, href: href(symbol), summary: `Inledde bevakning av ${security.name}` }).run();
  return (await getWatchItem(db, row!.id))!;
}

export type WatchPatch = { status?: WatchStatus; thesis?: string | null; triggers?: string | null; targetPrice?: number | null; ownerId?: number | null };

export async function updateWatchItem(db: D1Database, id: number, patch: WatchPatch, userId: number): Promise<WatchItem> {
  const item = await getWatchItem(db, id);
  if (!item) throw new WatchError("Bevakningen finns inte", 404);
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];
  const logs: D1PreparedStatement[] = [];
  const log = (action: string, summary: string) =>
    logs.push(activityStatement(db, { userId, action, entity: "watchlist", entityId: id, href: href(item.security.symbol), summary }));

  if (patch.status !== undefined && patch.status !== item.status) {
    sets.push("status = ?", "status_changed_at = ?");
    values.push(patch.status, now);
    log("watchlist.status", `${item.security.name}: ${STATUS_LABELS[item.status]} → ${STATUS_LABELS[patch.status]}`);
  }
  if (patch.thesis !== undefined && patch.thesis !== item.thesis) {
    sets.push("thesis = ?");
    values.push(patch.thesis || null);
    log("watchlist.thesis", `Uppdaterade tesen för ${item.security.name}`);
  }
  if (patch.triggers !== undefined && patch.triggers !== item.triggers) {
    sets.push("triggers = ?");
    values.push(patch.triggers || null);
    log("watchlist.triggers", `Uppdaterade triggers för ${item.security.name}`);
  }
  if (patch.targetPrice !== undefined && patch.targetPrice !== item.targetPrice) {
    sets.push("target_price = ?");
    values.push(patch.targetPrice);
    const fmt = (v: number | null) => (v == null ? "ingen" : `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(v)} ${item.security.currency}`);
    log("watchlist.target", `Målkurs för ${item.security.name}: ${fmt(item.targetPrice)} → ${fmt(patch.targetPrice)}`);
  }
  if (patch.ownerId !== undefined && patch.ownerId !== (item.owner?.id ?? null)) {
    sets.push("owner_id = ?");
    values.push(patch.ownerId);
  }
  if (sets.length === 1) return item;

  await db.batch([db.prepare(`UPDATE watchlist_items SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id), ...logs]);
  return (await getWatchItem(db, id))!;
}

export async function deleteWatchItem(db: D1Database, id: number, userId: number): Promise<void> {
  const item = await getWatchItem(db, id);
  if (!item) throw new WatchError("Bevakningen finns inte", 404);
  await db.batch([
    db.prepare("DELETE FROM watchlist_items WHERE id = ?").bind(id),
    activityStatement(db, { userId, action: "watchlist.deleted", entity: "watchlist", entityId: id, href: null, summary: `Tog bort bevakningen av ${item.security.name}` }),
  ]);
}

export async function listNotes(db: D1Database, itemId: number): Promise<WatchNote[]> {
  const { results } = await db
    .prepare("SELECT n.id, n.body, n.created_at, u.display_name FROM watchlist_notes n LEFT JOIN users u ON u.id = n.user_id WHERE n.item_id = ? ORDER BY n.created_at DESC, n.id DESC")
    .bind(itemId)
    .all<{ id: number; body: string; created_at: string; display_name: string | null }>();
  return results.map((r) => ({ id: r.id, body: r.body, userName: r.display_name, createdAt: r.created_at }));
}

export async function addNote(db: D1Database, itemId: number, body: string, userId: number): Promise<WatchNote> {
  const item = await getWatchItem(db, itemId);
  if (!item) throw new WatchError("Bevakningen finns inte", 404);
  const now = new Date().toISOString();
  const [res] = await db.batch<{ id: number }>([
    db.prepare("INSERT INTO watchlist_notes (item_id, user_id, body, created_at) VALUES (?, ?, ?, ?) RETURNING id").bind(itemId, userId, body, now),
    db.prepare("UPDATE watchlist_items SET updated_at = ? WHERE id = ?").bind(now, itemId),
    activityStatement(db, { userId, action: "watchlist.note", entity: "watchlist", entityId: itemId, href: href(item.security.symbol), summary: `Anteckning om ${item.security.name}: ${body.slice(0, 80)}${body.length > 80 ? " …" : ""}` }),
  ]);
  const notes = await listNotes(db, itemId);
  return notes.find((n) => n.id === res.results[0]?.id) ?? notes[0];
}
