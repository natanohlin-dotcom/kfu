import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { isBenchmarkColor, listBenchmarks, nextColor } from "@/lib/benchmarks";
import { getDb } from "@/lib/db";
import { getMarket, normalizeSymbol } from "@/lib/market";
import { ensureSecurity } from "@/lib/securities";

export async function GET() {
  const auth = await requireApiUser("dashboard:read");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await listBenchmarks(getDb()) });
  } catch (err) {
    return apiError(err, "Kunde inte läsa jämförelseindex");
  }
}

const Body = z.object({
  symbol: z.string().min(1).max(24),
  label: z.string().trim().min(1).max(40).optional(),
  color: z.string().optional(),
});

/** POST { symbol, label?, color? } → lägger till ett jämförelseindex (värdepapper och kurshistorik skapas vid behov). */
export async function POST(req: Request) {
  const auth = await requireApiUser("settings:benchmarks");
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  const symbol = parsed.success ? normalizeSymbol(parsed.data.symbol) : null;
  if (!parsed.success || !symbol) return NextResponse.json({ error: "Ogiltig symbol" }, { status: 400 });

  try {
    const db = getDb();
    const existing = await listBenchmarks(db);
    if (existing.some((b) => b.security.symbol === symbol)) {
      return NextResponse.json({ error: `${symbol} finns redan som jämförelseindex` }, { status: 409 });
    }
    if (existing.length >= 6) return NextResponse.json({ error: "Högst sex jämförelseindex" }, { status: 400 });

    const security = await ensureSecurity(db, getMarket(db), symbol);
    const color = isBenchmarkColor(parsed.data.color) ? parsed.data.color : nextColor(existing.map((b) => b.color));
    const label = parsed.data.label ?? security.name.slice(0, 40);
    await db
      .prepare("INSERT INTO benchmarks (security_id, label, color, is_default, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(security.id, label, color, existing.length === 0 ? 1 : 0, existing.length, new Date().toISOString())
      .run();
    await logActivity(db, { userId: auth.user.id, action: "benchmark.added", entity: "benchmark", href: "/admin/installningar/jamforelseindex", summary: `Lade till jämförelseindex ${label}` });
    return NextResponse.json({ success: true, data: await listBenchmarks(db) }, { status: 201 });
  } catch (err) {
    return apiError(err, "Kunde inte lägga till jämförelseindex");
  }
}
