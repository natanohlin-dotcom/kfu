import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { BENCHMARK_COLORS, listBenchmarks } from "@/lib/benchmarks";
import { getDb } from "@/lib/db";

const Patch = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  color: z.enum(BENCHMARK_COLORS.map((c) => c.token) as [string, ...string[]]).optional(),
  isDefault: z.literal(true).optional(),
});

/** PATCH { label?, color?, isDefault: true } – isDefault flyttar standardmarkeringen hit. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/benchmarks/[id]">) {
  const auth = await requireApiUser("settings:benchmarks");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });

  try {
    const db = getDb();
    const { label, color, isDefault } = parsed.data;
    const stmts = [];
    if (label !== undefined) stmts.push(db.prepare("UPDATE benchmarks SET label = ? WHERE id = ?").bind(label, id));
    if (color !== undefined) stmts.push(db.prepare("UPDATE benchmarks SET color = ? WHERE id = ?").bind(color, id));
    if (isDefault) stmts.push(db.prepare("UPDATE benchmarks SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").bind(id));
    if (stmts.length) await db.batch(stmts);
    return NextResponse.json({ success: true, data: await listBenchmarks(db) });
  } catch (err) {
    return apiError(err, "Kunde inte ändra jämförelseindex");
  }
}

/** DELETE – tar bort indexet. Var det standard blir det första kvarvarande standard. Värdepappret och kurserna ligger kvar. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/benchmarks/[id]">) {
  const auth = await requireApiUser("settings:benchmarks");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });

  try {
    const db = getDb();
    await db.batch([
      db.prepare("DELETE FROM benchmarks WHERE id = ?").bind(id),
      db.prepare(
        "UPDATE benchmarks SET is_default = 1 WHERE id = (SELECT id FROM benchmarks ORDER BY sort_order, id LIMIT 1) " +
          "AND NOT EXISTS (SELECT 1 FROM benchmarks WHERE is_default = 1)",
      ),
    ]);
    return NextResponse.json({ success: true, data: await listBenchmarks(db) });
  } catch (err) {
    return apiError(err, "Kunde inte ta bort jämförelseindex");
  }
}
