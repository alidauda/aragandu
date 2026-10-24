import "server-only";

import { prisma } from "@/lib/db";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { invNo } from "@/lib/orders";

/**
 * Every naira that moved between the farm and its egg buyers in a period,
 * in one list: invoice payments, orders paid up front, advances,
 * overpayments, refunds — and credit used on invoices (not new money).
 */

import type { LedgerEntry, LedgerKind, OnlineAttempt } from "@/lib/ledger";

export { LEDGER_KIND, type LedgerEntry, type LedgerKind, type OnlineAttempt } from "@/lib/ledger";

const between = (from: string, to: string) => ({ gte: toDbDate(from), lte: toDbDate(to) });

export async function paymentLedger(from: string, to: string) {
  const [payments, credits, charges] = await Promise.all([
    prisma.payment.findMany({
      where: { date: between(from, to) },
      include: { invoice: { select: { id: true, name: true } } },
    }),
    prisma.customerCredit.findMany({
      where: { date: between(from, to), kind: { not: "draw" } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.paystackCharge.findMany({
      where: {
        createdAt: { gte: toDbDate(from), lt: new Date(toDbDate(to).getTime() + 86_400_000) },
        status: { not: "paid" },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const entries: LedgerEntry[] = [
    ...payments.map((p) => ({
      key: `p${p.id}`,
      date: fromDbDate(p.date),
      at: p.createdAt.toISOString(),
      buyer: p.invoice.name,
      kind: (p.method === "credit" ? "credit-used" : "invoice") as LedgerKind,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      for: invNo(p.invoiceId),
      link: `/invoices/${p.invoiceId}`,
      by: p.by,
    })),
    ...credits.map((c) => {
      const kind = (["order", "advance", "overpayment", "refund"].includes(c.kind) ? c.kind : "advance") as LedgerKind;
      return {
        key: `c${c.id}`,
        date: fromDbDate(c.date),
        at: c.createdAt.toISOString(),
        buyer: c.customer.name,
        kind,
        amount: c.amount,
        method: c.method,
        reference: c.note,
        for: c.orderId ? `Order #${c.orderId}` : kind === "overpayment" ? (c.note.match(/INV-\d+/)?.[0] ?? "") : "Credit",
        link: null,
        by: c.by,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));

  const online: OnlineAttempt[] = charges.map((c) => ({
    reference: c.reference,
    at: c.createdAt.toISOString(),
    buyer: c.customer.name,
    amount: c.amount,
    status: c.status === "pending" ? "not completed" : c.status,
    for: c.orderId ? `Order #${c.orderId}` : c.invoiceId ? invNo(c.invoiceId) : "",
  }));

  return { entries, online };
}

export { ledgerTotals } from "@/lib/ledger";
