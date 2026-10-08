import type { Metadata } from "next";

import { BuyerDashboard, NotABuyer, PortalLogin } from "@/components/Portal";
import { prisma } from "@/lib/db";
import { farmToday, fromDbDate, weekStartOf } from "@/lib/dates";
import { getCratePrice } from "@/lib/erp/queries";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Argandu Farms — Buyer Portal",
  description: "Order eggs from Argandu Farms within your weekly allocation.",
};

/** The customer-facing buyer portal, kept at /portal while the staff ERP
 *  owns the root. Design pass on this comes later. */
export default async function BuyerPortalPage() {
  const session = await getSession();
  if (!session) return <PortalLogin />;

  const customerId = session.user.customerId;
  if (session.user.role !== "customer" || !customerId) return <NotABuyer />;

  // Scoped to the signed-in buyer's own records — the server is the gate.
  const [customer, cratePrice, orders, invoices] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    getCratePrice(),
    prisma.eggOrder.findMany({
      where: { customerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.invoice.findMany({
      where: { customerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
  ]);
  if (!customer) return <NotABuyer />;

  const today = farmToday();
  return (
    <BuyerDashboard
      name={customer.name}
      weeklyCrates={customer.weeklyCrates}
      cratePrice={cratePrice}
      weekStart={weekStartOf(today)}
      orders={orders.map((o) => ({
        id: o.id,
        date: fromDbDate(o.date),
        crates: o.crates,
        status: o.status,
        notes: o.notes,
      }))}
      invoices={invoices.map((v) => ({
        id: v.id,
        date: fromDbDate(v.date),
        product: v.product,
        qty: v.qty,
        unit: v.unit ?? "crates",
        amount: v.qty * v.price,
        status: v.status,
      }))}
    />
  );
}
