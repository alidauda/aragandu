import "server-only";

import { prisma } from "@/lib/db";
import { fromDbDate } from "@/lib/dates";

/** One invoice with its buyer and payments, shaped for the printable view. */
export async function loadInvoice(id: number) {
  const v = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true } },
      payments: { orderBy: [{ date: "asc" }, { id: "asc" }] },
    },
  });
  if (!v) return null;
  const total = v.qty * v.price;
  const paid = v.payments.reduce((a, p) => a + p.amount, 0);
  return {
    id: v.id,
    number: `INV-${String(v.id).padStart(5, "0")}`,
    date: fromDbDate(v.date),
    customerId: v.customerId,
    billTo: v.customer?.name ?? v.name,
    phone: v.customer?.phone ?? "",
    product: v.product,
    qty: v.qty,
    unit: v.unit ?? (v.product.startsWith("Eggs") ? "crates" : ""),
    price: v.price,
    total,
    paid,
    balance: total - paid,
    status: v.status,
    payments: v.payments.map((p) => ({
      date: fromDbDate(p.date),
      amount: p.amount,
      method: p.method,
      reference: p.reference,
    })),
  };
}

export type InvoiceView = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;
