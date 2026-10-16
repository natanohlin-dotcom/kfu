import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError, parseBody } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/market";
import { NewWatchInput } from "@/lib/watchlist/input";
import { createWatchItem, listWatchItems } from "@/lib/watchlist/repo";

/** GET ?archived=1 tar med arkiverade. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser("watchlist:read");
  if (!auth.ok) return auth.response;
  try {
    const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
    return NextResponse.json({ success: true, data: await listWatchItems(getDb(), { includeArchived }) });
  } catch (err) {
    return apiError(err, "Kunde inte läsa bevakningar");
  }
}

/** POST { symbol, status?, thesis?, triggers?, targetPrice?, ownerId? } → inleder bevakning. */
export async function POST(req: Request) {
  const auth = await requireApiUser("watchlist:write");
  if (!auth.ok) return auth.response;
  const body = await parseBody(req, NewWatchInput);
  if (!body.ok) return body.response;
  try {
    const db = getDb();
    return NextResponse.json({ success: true, data: await createWatchItem(db, getMarket(db), body.data, auth.user.id) }, { status: 201 });
  } catch (err) {
    return apiError(err, "Kunde inte inleda bevakning");
  }
}
