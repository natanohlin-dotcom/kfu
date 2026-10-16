import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { deleteTransaction, TransactionError } from "@/lib/portfolio/repo";

/** DELETE → tar bort transaktionen om historiken fortfarande går ihop utan den. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/portfolio/transactions/[id]">) {
  const auth = await requireApiUser("portfolio:write");
  if (!auth.ok) return auth.response;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
  try {
    const db = getDb();
    await deleteTransaction(db, id);
    await logActivity(db, { userId: auth.user.id, action: "transaction.deleted", entity: "transaction", entityId: id, href: "/admin/portfolj/transaktioner", summary: `Tog bort en transaktion (#${id})` });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TransactionError) return NextResponse.json({ error: err.message }, { status: 409 });
    return apiError(err, "Kunde inte ta bort transaktionen");
  }
}
