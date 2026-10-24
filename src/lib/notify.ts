import "server-only";

import { prisma } from "@/lib/db";
import { appUrl, emailEnabled } from "@/lib/email";
import { mailAdmins } from "@/lib/mail";
import { naira } from "@/lib/orders";

/** Tells the admins a buyer just ordered. Best-effort: never throws. */
export async function notifyNewOrder(orderId: number) {
  if (!emailEnabled()) return;
  try {
    const order = await prisma.eggOrder.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (!order) return;
    const what = `${order.customer.name} ordered ${order.crates} crates`;
    await mailAdmins({
      subject: `New egg order — ${what}`,
      lines: [`${what}.`],
      rows: [
        ["Crates", String(order.crates)],
        ...(order.price ? ([["Locked price", naira.format(order.price)]] as [string, string][]) : []),
        ...(order.notes ? ([["Note", order.notes]] as [string, string][]) : []),
      ],
      button: { label: "Open Egg orders", href: `${appUrl()}/layers/orders` },
    });
  } catch (e) {
    console.error("new-order notification failed", e);
  }
}

/**
 * Tells every admin about a sensitive change (payments undone, invoices
 * deleted, write-offs, online payments) so one admin can't quietly do it
 * alone. Best-effort.
 */
export async function alertAdmins(subject: string, text: string) {
  if (!emailEnabled()) return;
  try {
    await mailAdmins({
      subject: `Argandu: ${subject}`,
      lines: [text],
      button: { label: "Open Activity", href: `${appUrl()}/activity` },
    });
  } catch (e) {
    console.error("admin alert failed", e);
  }
}
