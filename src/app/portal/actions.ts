"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { markOrderPaidIfCovered, orderDue, placeEggOrder, releaseUnpaid, RuleError } from "@/lib/egg-orders";
import { portalLink } from "@/lib/portal-host";
import { later, mailOrderPaid } from "@/lib/mail";
import { notifyNewOrder } from "@/lib/notify";
import { PaystackError, paystackEnabled, startCheckout } from "@/lib/paystack";
import { AuthError, requireCustomer } from "@/lib/session";

const orderId = z.number().int().positive();

const orderInput = z.object({
  crates: z.number().int("Enter a whole number of crates.").positive("Enter a whole number of crates."),
  notes: z.string().trim().max(500),
});

type OrderResult =
  | { ok: false; error: string }
  /** paid: credit covered it. url: off to Paystack. Neither: pay later (transfer). */
  | { ok: true; paid: boolean; due: number; url?: string; notice?: string };

const callbackUrl = () => portalLink("/paystack/callback");

/** A paid order goes to the farm: tell the buyer and the admins. */
function announcePaid(orderId: number, paidNow = 0) {
  later(() => mailOrderPaid(orderId, paidNow));
  later(() => notifyNewOrder(orderId));
}

/**
 * The buyer's own order. Allocation and the debt gate are enforced here,
 * and it's paid for straight away — from their credit if that covers it,
 * otherwise on Paystack. Only paid orders reach the farm.
 */
export async function placeOrder(input: { crates: number; notes: string }): Promise<OrderResult> {
  let result: OrderResult;
  try {
    const { session, customerId } = await requireCustomer();
    const parsed = orderInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { order, paid, due } = await placeEggOrder(customerId, parsed.data.crates, parsed.data.notes);
    await audit({
      userId: session.user.id,
      actor: session.user.name,
      action: "placeOrder",
      summary: `order #${order.id} · ${order.crates} crates${paid ? " · paid from credit" : ` · ${due} to pay`}${
        order.notes ? ` · “${order.notes}”` : ""
      }`,
      details: { orderId: order.id, crates: order.crates, notes: order.notes, paid, due },
    });
    if (paid) {
      announcePaid(order.id);
      result = { ok: true, paid: true, due: 0 };
    } else if (paystackEnabled()) {
      try {
        const url = await startCheckout({
          customerId,
          email: session.user.email,
          amount: due,
          orderId: order.id,
          callbackUrl: callbackUrl(),
        });
        result = { ok: true, paid: false, due, url };
      } catch (e) {
        console.error(e);
        result = {
          ok: true,
          paid: false,
          due,
          notice: "Your order is saved, but Paystack couldn't start. Press Pay now on it to try again.",
        };
      }
    } else {
      result = { ok: true, paid: false, due };
    }
  } catch (e) {
    if (e instanceof AuthError || e instanceof RuleError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Couldn't place the order. Please try again." };
  }
  refresh();
  return result;
}

/** Pays for one of the buyer's own unpaid orders: from credit, or on Paystack. */
export async function payOrder(id: number): Promise<OrderResult> {
  let result: OrderResult;
  try {
    const { session, customerId } = await requireCustomer();
    const parsed = orderId.safeParse(id);
    if (!parsed.success) return { ok: false, error: "That order wasn't found." };
    await releaseUnpaid(prisma, customerId);
    const order = await prisma.eggOrder.findFirst({ where: { id: parsed.data, customerId } });
    if (!order) return { ok: false, error: "That order wasn't found." };
    if (order.paidAt) return { ok: false, error: "This order is already paid for." };
    if (order.status !== "pending") {
      return { ok: false, error: "This order was released — place a new one." };
    }
    const due = await prisma.$transaction((tx) => orderDue(tx, order));
    if (due === 0) {
      const paid = await prisma.$transaction((tx) => markOrderPaidIfCovered(tx, order.id));
      if (paid) announcePaid(order.id);
      result = { ok: true, paid, due: 0 };
    } else {
      if (!paystackEnabled()) {
        return { ok: false, error: "Online payment isn't set up — pay by bank transfer and the farm will confirm it." };
      }
      const url = await startCheckout({
        customerId,
        email: session.user.email,
        amount: due,
        orderId: order.id,
        callbackUrl: callbackUrl(),
      });
      result = { ok: true, paid: false, due, url };
    }
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    console.error(e);
    return {
      ok: false,
      error:
        e instanceof PaystackError
          ? "Paystack couldn't start the payment. Please try again shortly."
          : "Couldn't start the payment. Please try again.",
    };
  }
  refresh();
  return result;
}

/** The buyer drops one of their own unpaid orders; its crates go back on the allocation. */
export async function cancelOrder(id: number) {
  try {
    const { session, customerId } = await requireCustomer();
    const parsed = orderId.safeParse(id);
    if (!parsed.success) return { ok: false as const, error: "That order wasn't found." };
    const r = await prisma.eggOrder.updateMany({
      where: { id: parsed.data, customerId, status: "pending", paidAt: null },
      data: { status: "declined", declineReason: "Cancelled by the buyer" },
    });
    if (r.count === 0) return { ok: false as const, error: "Only an unpaid order can be cancelled." };
    await audit({
      userId: session.user.id,
      actor: session.user.name,
      action: "cancelOrder",
      summary: `order #${parsed.data} cancelled before paying`,
      details: { orderId: parsed.data },
    });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: e.message };
    console.error(e);
    return { ok: false as const, error: "Couldn't cancel it. Please try again." };
  }
  refresh();
  return { ok: true as const };
}

/** The buyer confirms the crates for one of their own fulfilled orders arrived. */
export async function confirmReceived(id: number) {
  try {
    const { session, customerId } = await requireCustomer();
    const parsed = orderId.safeParse(id);
    if (!parsed.success) return { ok: false as const, error: "That order wasn't found." };
    // Scoped to this buyer's own fulfilled, unconfirmed orders.
    const r = await prisma.eggOrder.updateMany({
      where: { id: parsed.data, customerId, status: "fulfilled", deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
    if (r.count === 0) return { ok: false as const, error: "That order is already confirmed." };
    await audit({
      userId: session.user.id,
      actor: session.user.name,
      action: "confirmReceived",
      summary: `order #${parsed.data} · crates received`,
      details: { orderId: parsed.data },
    });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: e.message };
    console.error(e);
    return { ok: false as const, error: "Couldn't save that. Please try again." };
  }
  refresh();
  return { ok: true as const };
}

/**
 * Starts a Paystack checkout for what's left on one of the buyer's own
 * invoices. The browser is sent to Paystack; the money is recorded only
 * once Paystack confirms it (see /portal/paystack/callback and the webhook).
 */
export async function payInvoice(id: number) {
  try {
    const { session, customerId } = await requireCustomer();
    if (!paystackEnabled()) return { ok: false as const, error: "Online payment isn't set up yet." };
    const parsed = orderId.safeParse(id);
    if (!parsed.success) return { ok: false as const, error: "That invoice wasn't found." };
    const inv = await prisma.invoice.findFirst({
      where: { id: parsed.data, customerId },
      select: { id: true, qty: true, price: true, status: true, payments: { select: { amount: true } } },
    });
    if (!inv) return { ok: false as const, error: "That invoice wasn't found." };
    const balance = inv.qty * inv.price - inv.payments.reduce((a, p) => a + p.amount, 0);
    if (inv.status === "paid" || balance <= 0) return { ok: false as const, error: "This invoice is already paid." };

    const url = await startCheckout({
      customerId,
      email: session.user.email,
      amount: balance,
      invoiceId: inv.id,
      callbackUrl: callbackUrl(),
    });
    return { ok: true as const, url };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: e.message };
    console.error(e);
    return {
      ok: false as const,
      error:
        e instanceof PaystackError
          ? "Paystack couldn't start the payment. Please try again shortly."
          : "Couldn't start the payment. Please try again.",
    };
  }
}
