import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError, parseBody } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { WatchPatchInput } from "@/lib/watchlist/input";
import { deleteWatchItem, updateWatchItem } from "@/lib/watchlist/repo";

export async function PATCH(req: Request, ctx: RouteContext<"/api/watchlist/[id]">) {
  const auth = await requireApiUser("watchlist:write");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, WatchPatchInput);
  if (!body.ok) return body.response;
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await updateWatchItem(getDb(), id, body.data, auth.user.id) });
  } catch (err) {
    return apiError(err, "Kunde inte uppdatera bevakningen");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/watchlist/[id]">) {
  const auth = await requireApiUser("watchlist:write");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
  try {
    await deleteWatchItem(getDb(), id, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "Kunde inte ta bort bevakningen");
  }
}
