import "server-only";

import { toDbDate } from "@/lib/dates";
import { RuleError, type Tx } from "@/lib/rules";

/**
 * Money in. Payments land on invoices; anything more than an invoice's
 * balance — or paid with no invoice at all — becomes the buyer's credit,
 * which is drawn automatically against their next invoices.
 */

type Method = "transfer" | "cash" | "pos";

/** A buyer's credit balance: advances and overpayments, less what's been used. */
export async function creditBalance(tx: Tx, customerId: number) {
  const r = await tx.customerCredit.aggregate({ where: { customerId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

/** Locks an invoice and returns its total and what's been paid so far. */
async function lockInvoice(tx: Tx, invoiceId: number) {
  const rows = await tx.$queryRaw<{ qty: number; price: number; customerId: number | null; date: Date }[]>`
    SELECT qty, price, "customerId", date FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
  if (!rows[0]) throw new RuleError("That invoice no longer exists.");
  const paid =
    (await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } }))._sum.amount ?? 0;
  const total = rows[0].qty * rows[0].price;
  const date = rows[0].date.toISOString().slice(0, 10);
  return { total, paid, balance: total - paid, customerId: rows[0].customerId, date };
}

async function markPaidIfCovered(tx: Tx, invoiceId: number, today: string) {
  const { balance } = await lockInvoice(tx, invoiceId);
  if (balance <= 0) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "paid", paidAt: toDbDate(today) } });
  }
}

/**
 * Records money received against an invoice. "balance" pays exactly what's
 * owed. More than the balance is kept as the buyer's credit (walk-ins
 * can't hold credit, so that's refused for them).
 */
export async function receivePayment(
  tx: Tx,
  invoiceId: number,
  amount: number | "balance",
  p: { method: Method; reference: string; today: string; by: string }
) {
  const inv = await lockInvoice(tx, invoiceId);
  if (inv.balance <= 0) throw new RuleError("This invoice is already paid.");
  if (p.today < inv.date) throw new RuleError(`The invoice is dated ${inv.date} — a payment can't be earlier.`);
  const value = amount === "balance" ? inv.balance : amount;
  const applied = Math.min(value, inv.balance);
  const extra = value - applied;
  if (extra > 0 && !inv.customerId) {
    throw new RuleError(
      `Only ${inv.balance.toLocaleString("en-US")} naira is outstanding, and walk-ins can't hold credit.`
    );
  }
  await tx.payment.create({
    data: {
      invoiceId,
      date: toDbDate(p.today),
      amount: applied,
      method: p.method,
      reference: p.reference,
      by: p.by,
    },
  });
  if (extra > 0 && inv.customerId) {
    await tx.customerCredit.create({
      data: {
        customerId: inv.customerId,
        date: toDbDate(p.today),
        amount: extra,
        note: `Overpaid on INV-${String(invoiceId).padStart(5, "0")}${p.reference ? ` (${p.reference})` : ""}`,
        by: p.by,
      },
    });
  }
  await markPaidIfCovered(tx, invoiceId, p.today);
  return { applied, credit: extra };
}

/** Money paid in advance, with no invoice yet: all of it is credit. */
export async function receiveAdvance(
  tx: Tx,
  customerId: number,
  amount: number,
  p: { method: Method; reference: string; today: string; by: string }
) {
  await tx.customerCredit.create({
    data: {
      customerId,
      date: toDbDate(p.today),
      amount,
      note: `Paid in advance by ${p.method}${p.reference ? ` (${p.reference})` : ""}`,
      by: p.by,
    },
  });
  // Anything they already owe is settled from it straight away, oldest first.
  const open = await tx.invoice.findMany({
    where: { customerId, status: "pending" },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  for (const v of open) {
    if ((await creditBalance(tx, customerId)) <= 0) break;
    await applyCredit(tx, v.id, p.today, p.by);
  }
}

/** Draws the buyer's credit against an invoice, as far as it goes. */
export async function applyCredit(tx: Tx, invoiceId: number, day: string, by: string) {
  const inv = await lockInvoice(tx, invoiceId);
  if (!inv.customerId || inv.balance <= 0) return 0;
  // Credit paid in earlier is used on the invoice's own date.
  const today = day < inv.date ? inv.date : day;
  const available = await creditBalance(tx, inv.customerId);
  const use = Math.min(available, inv.balance);
  if (use <= 0) return 0;
  const payment = await tx.payment.create({
    data: {
      invoiceId,
      date: toDbDate(today),
      amount: use,
      method: "credit",
      reference: "From credit",
      by,
    },
  });
  await tx.customerCredit.create({
    data: {
      customerId: inv.customerId,
      date: toDbDate(today),
      amount: -use,
      note: `Used on INV-${String(invoiceId).padStart(5, "0")}`,
      by,
      paymentId: payment.id,
    },
  });
  await markPaidIfCovered(tx, invoiceId, today);
  return use;
}
