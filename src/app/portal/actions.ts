"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { placeEggOrder, RuleError } from "@/lib/egg-orders";
import { notifyNewOrder } from "@/lib/notify";
import { AuthError, requireCustomer } from "@/lib/session";

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
