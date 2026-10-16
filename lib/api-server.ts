import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { MarketDataError } from "@/lib/market/types";

/** Gemensam felhantering för API-routes (mall §6): { error } med rätt status. */
export function apiError(err: unknown, context: string): NextResponse {
  if (err instanceof MarketDataError) {
    return NextResponse.json({ error: err.status === 404 ? err.message : "Marknadsdata kunde inte hämtas just nu" }, { status: err.status });
  }
  // Domänfel (t.ex. WatchError, TransactionError) bär eget meddelande och status
  if (err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number") {
    const e = err as Error & { status: number; field?: string };
    return NextResponse.json({ error: e.message, field: e.field }, { status: e.status });
  }
  console.error(context, err);
  return NextResponse.json({ error: "Serverfel" }, { status: 500 });
}

/** Läser och validerar JSON-kroppen. Första felet blir { error, field } med status 400. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, response: NextResponse.json({ error: issue?.message ?? "Ogiltig förfrågan", field: issue?.path[0] }, { status: 400 }) };
}
