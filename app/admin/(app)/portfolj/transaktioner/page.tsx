import type { Metadata } from "next";
import Link from "next/link";
import { DeleteTransactionButton } from "@/components/portfolio/DeleteTransactionButton";
import { TransactionForm } from "@/components/portfolio/TransactionForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { num, price, shortDate, signedSek } from "@/lib/format";
import { listTransactions } from "@/lib/portfolio/repo";
import { TYPE_LABELS, type TransactionType } from "@/lib/portfolio/types";

export const metadata: Metadata = { title: "Transaktioner" };

const TONES: Record<TransactionType, "neutral" | "accent" | "up" | "down" | "warn" | "brand"> = {
  deposit: "accent",
  withdrawal: "neutral",
  buy: "neutral",
  sell: "neutral",
  dividend: "up",
  fee: "warn",
};

export default async function TransactionsPage() {
  const user = await requireUser("portfolio:read");
  const transactions = await listTransactions(getDb());
  const canWrite = can(user, "portfolio:write");

  return (
    <div>
      <PageHeader title="Transaktioner" description="Insättningar, affärer och utdelningar. Innehav, kassa och avkastning räknas fram härifrån." />
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {canWrite && (
          <Card title="Ny transaktion">
            <TransactionForm />
          </Card>
        )}

        <Card title="Historik" description={transactions.length ? `${transactions.length} transaktioner` : undefined} className={canWrite ? "" : "xl:col-span-2"}>
          {transactions.length === 0 ? (
            <EmptyState title="Inga transaktioner ännu">
              Börja med en insättning av portföljens startkapital, och registrera sedan köpen.
            </EmptyState>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="pb-2 font-normal">Datum</th>
                    <th className="pb-2 font-normal">Typ</th>
                    <th className="pb-2 font-normal">Värdepapper</th>
                    <th className="pb-2 text-right font-normal">Antal × kurs</th>
                    <th className="pb-2 text-right font-normal">Kassa</th>
                    <th className="pb-2"><span className="sr-only">Åtgärder</span></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-line align-top">
                      <td className="tabular py-3 pr-3 whitespace-nowrap text-ink">{shortDate(t.tradeDate)}</td>
                      <td className="py-3 pr-3"><Badge tone={TONES[t.type]}>{TYPE_LABELS[t.type]}</Badge></td>
                      <td className="py-3 pr-3">
                        {t.symbol ? (
                          <Link href={`/admin/bolag/${encodeURIComponent(t.symbol)}`} className="text-ink hover:underline">{t.securityName}</Link>
                        ) : (
                          <span className="text-ink-subtle">–</span>
                        )}
                        {t.note && <div className="text-ink-muted">{t.note}</div>}
                        <div className="text-xs text-ink-subtle">{t.createdBy ? `Av ${t.createdBy}` : ""}</div>
                      </td>
                      <td className="tabular py-3 pr-3 text-right whitespace-nowrap text-ink">
                        {t.quantity != null && t.price != null ? (
                          <>{num(t.quantity, t.quantity % 1 ? 2 : 0)} × {price(t.price, t.currency)}</>
                        ) : (
                          <span className="text-ink-muted">{price(t.amountLocal, t.currency)}</span>
                        )}
                        {t.currency !== "SEK" && <div className="text-xs text-ink-subtle">kurs {num(t.fxRate, 4)} SEK</div>}
                        {t.feesSek > 0 && <div className="text-xs text-ink-subtle">courtage {price(t.feesSek, "kr")}</div>}
                      </td>
                      <td className={`tabular py-3 pr-2 text-right whitespace-nowrap ${t.cashSek >= 0 ? "text-up" : "text-ink"}`}>{signedSek(t.cashSek)}</td>
                      <td className="py-2 text-right">{canWrite && <DeleteTransactionButton id={t.id} label={`${TYPE_LABELS[t.type]} ${shortDate(t.tradeDate)}`} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
