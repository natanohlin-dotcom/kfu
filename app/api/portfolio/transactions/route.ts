import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/api-server";
import { getDb } from "@/lib/db";
import { getMarket } from "@/lib/market";
import { TransactionInput } from "@/lib/portfolio/input";
import { addTransaction, listTransactions, TransactionError } from "@/lib/portfolio/repo";

export async function GET() {
  const auth = await requireApiUser("portfolio:read");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await listTransactions(getDb()) });
  } catch (err) {
    return apiError(err, "Kunde inte läsa transaktioner");
  }
}

/** POST → ny transaktion. Kassapåverkan, valutakurs och validering mot hela historiken görs här. */
export async function POST(req: Request) {
  const auth = await requireApiUser("portfolio:write");
  if (!auth.ok) return auth.response;

  const parsed = TransactionInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Ogiltig transaktion", field: issue?.path[0] }, { status: 400 });
  }
  try {
    const db = getDb();
    const tx = await addTransaction(db, getMarket(db), parsed.data, auth.user.id);
    return NextResponse.json({ success: true, data: tx }, { status: 201 });
  } catch (err) {
    if (err instanceof TransactionError) return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
    return apiError(err, "Kunde inte spara transaktionen");
  }
}
