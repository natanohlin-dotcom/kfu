import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { getRawMarket } from "@/lib/market";
import { lastPriceUpdate, runDailyPriceUpdate } from "@/lib/market/prices";

/** GET → senaste kursuppdateringen. POST → kör uppdateringen nu (samma som den dagliga cron-körningen). */
export async function GET() {
  const auth = await requireApiUser("dashboard:read");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, data: await lastPriceUpdate(getDb()) });
}

export async function POST() {
  const auth = await requireApiUser("settings:benchmarks");
  if (!auth.ok) return auth.response;
  try {
    const db = getDb();
    return NextResponse.json({ success: true, data: await runDailyPriceUpdate(db, getRawMarket(db)) });
  } catch (err) {
    return apiError(err, "Kursuppdatering misslyckades");
  }
}
