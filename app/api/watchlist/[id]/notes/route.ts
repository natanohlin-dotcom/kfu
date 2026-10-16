import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError, parseBody } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { NoteInput } from "@/lib/watchlist/input";
import { addNote, listNotes } from "@/lib/watchlist/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/watchlist/[id]/notes">) {
  const auth = await requireApiUser("watchlist:read");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
  return NextResponse.json({ success: true, data: await listNotes(getDb(), id) });
}

export async function POST(req: Request, ctx: RouteContext<"/api/watchlist/[id]/notes">) {
  const auth = await requireApiUser("watchlist:write");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  const body = await parseBody(req, NoteInput);
  if (!body.ok) return body.response;
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await addNote(getDb(), id, body.data.body, auth.user.id) }, { status: 201 });
  } catch (err) {
    return apiError(err, "Kunde inte spara anteckningen");
  }
}
