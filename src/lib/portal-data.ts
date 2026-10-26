import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { releaseUnpaid } from "@/lib/egg-orders";
import { farmToday, fromDbDate, weekStartOf } from "@/lib/dates";
import { getSettings } from "@/lib/erp/queries";
import type { PortalCredit, PortalInvoice, PortalOrder, PortalPayment } from "@/lib/orders";
import { onlinePayments, paymentSettings } from "@/lib/payment-mode";
import { getSession } from "@/lib/session";

export type BuyerData = {
  name: string;
  email: string;
  weeklyCrates: number;
  cratePrice: number;
  eggsPerCrate: number;
  credit: number;
  /** Credit holding paid orders the farm hasn't fulfilled yet. */
  heldCredit: number;
  today: string;
  weekStart: string;
  payOnline: boolean;
  /** How to pay the farm directly (bank details…), set by the farm. */
  paymentNote: string;
  orders: PortalOrder[];
  invoices: PortalInvoice[];
  payments: PortalPayment[];
  credits: PortalCredit[];
};

export type Buyer =
  | { state: "signed-out" }
  | { state: "not-buyer" }
  | { state: "buyer"; data: BuyerData };

/**
 * The signed-in buyer and everything of theirs the portal shows, scoped to
 * their own customer record — the server is the gate. Cached per request, so
 * the layout and the page share one load.
 */
export const getBuyer = cache(async (): Promise<Buyer> => {
  const session = await getSession();
  if (!session) return { state: "signed-out" };
  const customerId = session.user.customerId;
  if (session.user.role !== "customer" || !customerId || session.user.disabled) {
    return { state: "not-buyer" };
  }

  await releaseUnpaid(prisma, customerId);
  const [customer, settings, orders, invoices, credits] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    getSettings(),
    prisma.eggOrder.findMany({
      where: { customerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { invoice: { select: { id: true } } },
    }),
    prisma.invoice.findMany({
      where: { customerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { payments: { orderBy: [{ date: "desc" }, { id: "desc" }] } },
    }),
    prisma.customerCredit.findMany({
      where: { customerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
  ]);
  // A removed (archived) buyer's logins are off; treat any stray session the same.
  if (!customer || customer.archivedAt) return { state: "not-buyer" };

  const today = farmToday();
  const [payOnline, payment] = await Promise.all([onlinePayments(), paymentSettings()]);
  return {
    state: "buyer",
    data: {
      name: customer.name,
      email: session.user.email,
      weeklyCrates: customer.weeklyCrates,
      // Their own price when the farm set one.
      cratePrice: customer.cratePrice ?? settings.cratePrice,
      eggsPerCrate: settings.eggsPerCrate,
      credit: credits.reduce((a, c) => a + c.amount, 0),
      heldCredit: orders
        .filter((o) => o.status === "pending" && o.paidAt)
        .reduce((a, o) => a + o.crates * (o.price ?? 0), 0),
      today,
      weekStart: weekStartOf(today),
      payOnline: payOnline,
      paymentNote: payment.note,
      orders: orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        date: fromDbDate(o.date),
        crates: o.crates,
        status: o.status,
        notes: o.notes,
        price: o.price,
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
        invoiceId: o.invoice?.id ?? null,
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        payBy: o.payBy ? o.payBy.toISOString() : null,
        declineReason: o.declineReason,
      })),
      invoices: invoices.map((v) => ({
        id: v.id,
        createdAt: v.createdAt.toISOString(),
        date: fromDbDate(v.date),
        product: v.product,
        qty: v.qty,
        unit: v.unit ?? "crates",
        amount: v.qty * v.price,
        paid: v.payments.reduce((a, p) => a + p.amount, 0),
        status: v.status,
      })),
      payments: invoices
        .flatMap((v) =>
          v.payments.map((p) => ({
            id: p.id,
            createdAt: p.createdAt.toISOString(),
            date: fromDbDate(p.date),
            invoiceId: v.id,
            amount: p.amount,
            method: p.method,
            reference: p.reference,
          }))
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
      credits: credits.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        date: fromDbDate(c.date),
        amount: c.amount,
        note: c.note,
      })),
    },
  };
});
