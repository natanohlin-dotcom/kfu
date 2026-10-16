import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { getMarket, normalizeSymbol } from "@/lib/market";

/** GET /api/market/quotes?symbols=NOVO-B.CO,^OMX → senaste kurser (cachade 15 min). */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser("dashboard:read");
  if (!auth.ok) return auth.response;

  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map(normalizeSymbol)
    .filter((s): s is string => !!s)
    .slice(0, 20);
  if (!symbols.length) return NextResponse.json({ error: "Ange symbols" }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await getMarket(getDb()).quotes(symbols) });
  } catch (err) {
    return apiError(err, "Kurshämtning misslyckades");
  }
}
