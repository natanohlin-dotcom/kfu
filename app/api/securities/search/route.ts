import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/market";

/** GET /api/securities/search?q=novo → träffar från marknadsdatakällan (cachade ett dygn). */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser("dashboard:read");
  if (!auth.ok) return auth.response;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 50) return NextResponse.json({ success: true, data: [] });
  try {
    const hits = await getMarket(getDb()).search(q);
    return NextResponse.json({ success: true, data: hits.slice(0, 8) });
  } catch (err) {
    return apiError(err, "Sökning misslyckades");
  }
}
