import "server-only";

import { prisma } from "@/lib/db";
import { appUrl, emailEnabled, esc, sendEmail } from "@/lib/email";

/** Tells the admins a buyer just ordered. Best-effort: never throws. */
export async function notifyNewOrder(orderId: number) {
  if (!emailEnabled()) return;
  try {
    const [order, admins] = await Promise.all([
      prisma.eggOrder.findUnique({ where: { id: orderId }, include: { customer: true } }),
      prisma.user.findMany({ where: { role: "admin", disabled: false }, select: { email: true } }),
    ]);
    if (!order) return;
    const link = `${appUrl()}/layers/orders`;
    const what = `${order.customer.name} ordered ${order.crates} crates`;
    await sendEmail({
      to: admins.map((a) => a.email),
      subject: `New egg order — ${what}`,
      text: `${what}.${order.notes ? `\nNote: ${order.notes}` : ""}\n\nReview it: ${link}`,
      html: `<p><strong>${esc(what)}</strong>.</p>${
        order.notes ? `<p>Note: ${esc(order.notes)}</p>` : ""
      }<p><a href="${link}">Open Egg orders</a></p>`,
    });
  } catch (e) {
    console.error("new-order notification failed", e);
  }
}
