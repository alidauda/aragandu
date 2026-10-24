"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { placeEggOrder, RuleError } from "@/lib/egg-orders";
import { appUrl } from "@/lib/email";
import { notifyNewOrder } from "@/lib/notify";
import { initializeCharge, newReference, PaystackError, paystackEnabled } from "@/lib/paystack";
import { AuthError, requireCustomer } from "@/lib/session";

const orderId = z.number().int().positive();

const orderInput = z.object({
  crates: z.number().int("Enter a whole number of crates.").positive("Enter a whole number of crates."),
  notes: z.string().trim().max(500),
});

/** The buyer's own order; allocation and the debt gate are enforced here. */
export async function placeOrder(input: { crates: number; notes: string }) {
  try {
    const { session, customerId } = await requireCustomer();
    const parsed = orderInput.safeParse(input);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
    const order = await placeEggOrder(customerId, parsed.data.crates, parsed.data.notes);
    await audit({
      userId: session.user.id,
      actor: session.user.name,
      action: "placeOrder",
      summary: `order #${order.id} · ${order.crates} crates${order.notes ? ` · “${order.notes}”` : ""}`,
      details: { orderId: order.id, crates: order.crates, notes: order.notes },
    });
    await notifyNewOrder(order.id);
  } catch (e) {
    if (e instanceof AuthError || e instanceof RuleError) {
      return { ok: false as const, error: e.message };
    }
    console.error(e);
    return { ok: false as const, error: "Couldn't place the order. Please try again." };
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

    const reference = newReference(inv.id);
    await prisma.paystackCharge.create({
      data: { reference, invoiceId: inv.id, customerId, amount: balance, email: session.user.email },
    });
    const checkout = await initializeCharge({
      email: session.user.email,
      amount: balance,
      reference,
      callbackUrl: `${appUrl()}/portal/paystack/callback`,
      metadata: { invoiceId: inv.id, customerId },
    });
    return { ok: true as const, url: checkout.authorization_url };
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
