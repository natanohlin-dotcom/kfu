import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import { runYahooSpike } from "@/lib/market/spike";

/**
 * Fas 0: GET /api/spike/yahoo?symbol=NOVO-B.CO&benchmark=^OMX[&fresh=1]
 *        GET /api/spike/yahoo?last=cron  → senaste körningen från cron
 * Skyddad med rubriken x-spike-secret. Tas bort när datalagret i fas 2 är på plats.
 */
export async function GET(req: NextRequest) {
  const secret = optionalEnv("SPIKE_SECRET");
  if (!secret) return NextResponse.json({ error: "SPIKE_SECRET saknas" }, { status: 500 });
  if (req.headers.get("x-spike-secret") !== secret) {
    return NextResponse.json({ error: "Obehörig" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  try {
    const db = getDb();
    const last = params.get("last");
    if (last) {
      const row = await db
        .prepare("SELECT value FROM app_state WHERE key = ?")
        .bind(`spike.yahoo.${last}`)
        .first<{ value: string }>();
      return NextResponse.json({ success: true, data: row ? JSON.parse(row.value) : null });
    }

    const data = await runYahooSpike(db, {
      symbol: params.get("symbol") ?? "NOVO-B.CO",
      benchmark: params.get("benchmark") ?? "^OMX",
      trigger: "http",
      colo: getCloudflareContext().cf?.colo as string | undefined,
      freshSession: params.get("fresh") === "1",
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
