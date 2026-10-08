import "server-only";

import { prisma } from "@/lib/db";
import { farmToday, toDbDate, weekStartOf } from "@/lib/dates";
import { allocationLeft, naira } from "@/lib/orders";

/** A rule the user broke — its message is safe to show them. */
export class RuleError extends Error {}

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The invoice product that draws on the crate store. */
export const EGG_PRODUCT = "Eggs (crates)";

// Any number works; it only has to be the same for every crate-taking write.
const EGG_STOCK_LOCK = 4242;

/**
 * Checks the crate store can cover `crates`, holding a transaction-scoped
 * lock so two writes can't both spend the same stock. Stock is derived the
 * way the Egg inventory screen shows it: graded in − non-sale outs − sold.
 */
export async function takeCrates(tx: Tx, crates: number) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${EGG_STOCK_LOCK})::text`;
  const [moves, sold] = await Promise.all([
    tx.eggMove.groupBy({ by: ["type"], _sum: { crates: true } }),
    tx.invoice.aggregate({ where: { product: EGG_PRODUCT }, _sum: { qty: true } }),
  ]);
  const moved = (t: "in" | "out") =>
    moves.find((m) => m.type === t)?._sum.crates ?? 0;
  const stock = moved("in") - moved("out") - (sold._sum.qty ?? 0);
  if (crates > stock) {
    throw new RuleError(
      stock <= 0
        ? "No crates in stock. Record graded crates under Egg inventory first."
        : `Only ${stock} crates in stock.`
    );
  }
}

/** Locks the buyer's row so two orders can't both pass the allocation check. */
async function lockCustomer(tx: Tx, customerId: number) {
  const rows = await tx.$queryRaw<{ weeklyCrates: number; name: string }[]>`
    SELECT "weeklyCrates", "name" FROM customers WHERE id = ${customerId} FOR UPDATE`;
  if (!rows[0]) throw new RuleError("That buyer no longer exists.");
  return rows[0];
}

async function assertNoBlockingDebt(tx: Tx, customerId: number, weekStart: string) {
  const unpaid = await tx.invoice.findMany({
    where: { customerId, status: "pending", date: { lt: toDbDate(weekStart) } },
    select: { qty: true, price: true, payments: { select: { amount: true } } },
  });
  if (unpaid.length > 0) {
    // What's still owed: totals less any part-payments.
    const owed = unpaid.reduce(
      (a, v) => a + v.qty * v.price - v.payments.reduce((p, x) => p + x.amount, 0),
      0
    );
    throw new RuleError(
      `On debt hold: ${naira.format(owed)} unpaid from previous weeks.`
    );
  }
}

/** Places an order under both rules. Used by the portal and by staff. */
export async function placeEggOrder(customerId: number, crates: number, notes = "") {
  const today = farmToday();
  const weekStart = weekStartOf(today);
  return prisma.$transaction(async (tx) => {
    const customer = await lockCustomer(tx, customerId);
    await assertNoBlockingDebt(tx, customerId, weekStart);
    const used = await tx.eggOrder.aggregate({
      where: {
        customerId,
        date: { gte: toDbDate(weekStart) },
        status: { not: "declined" },
      },
      _sum: { crates: true },
    });
    const left = allocationLeft(customer.weeklyCrates, used._sum.crates ?? 0);
    if (crates > left) {
      throw new RuleError(
        left === 0
          ? `${customer.name} has used this week's full allocation.`
          : `Only ${left} crates left on this week's allocation.`
      );
    }
    return tx.eggOrder.create({
      data: { date: toDbDate(today), customerId, crates, notes },
    });
  });
}

/** Fulfil → invoice at today's crate price, atomically. */
export async function fulfilEggOrder(orderId: number) {
  const today = farmToday();
  return prisma.$transaction(async (tx) => {
    const order = await tx.eggOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "pending") {
      throw new RuleError("This order has already been handled.");
    }
    const customer = await lockCustomer(tx, order.customerId);
    await assertNoBlockingDebt(tx, order.customerId, weekStartOf(today));
    const settings = await tx.settings.findUnique({ where: { id: 1 } });
    if (!settings?.cratePrice) throw new RuleError("Set the crate price first.");

    // Conditional update: a concurrent fulfil/decline makes this a no-op.
    const flipped = await tx.eggOrder.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "fulfilled" },
    });
    if (flipped.count === 0) throw new RuleError("This order has already been handled.");
    await takeCrates(tx, order.crates);

    await tx.invoice.create({
      data: {
        date: toDbDate(today),
        customerId: order.customerId,
        name: customer.name,
        product: EGG_PRODUCT,
        qty: order.crates,
        price: settings.cratePrice,
        orderId: order.id,
      },
    });
  });
}
