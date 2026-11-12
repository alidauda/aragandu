import "server-only";

import { prisma } from "@/lib/db";
import { farmToday, toDbDate, weekStartOf } from "@/lib/dates";
import { applyCredit, availableCredit, paidTowardsOrder } from "@/lib/money";
import { allocationLeft, naira } from "@/lib/orders";
import { RuleError, type Tx } from "@/lib/rules";

export { RuleError, type Tx };

/** The invoice product that draws on the crate store. */
export const EGG_PRODUCT = "Eggs (crates)";

/** The egg-move reason an admin uses for crates already on the shelf at go-live. */
export const OPENING_STOCK = "opening stock";

// Any number works; it only has to be the same for every crate-store write.
const EGG_STOCK_LOCK = 4242;

export const lockEggStore = (tx: Tx) =>
  tx.$queryRaw`SELECT pg_advisory_xact_lock(${EGG_STOCK_LOCK})::text`;

async function eggsPerCrate(tx: Tx) {
  return (await tx.settings.findUnique({ where: { id: 1 } }))?.eggsPerCrate ?? 30;
}

/** Crates on the shelf: approved graded-in − approved outs − crates sold. */
export async function crateStock(tx: Tx) {
  const [moves, sold] = await Promise.all([
    tx.eggMove.groupBy({ by: ["type"], where: { status: "approved" }, _sum: { crates: true } }),
    tx.invoice.aggregate({ where: { product: EGG_PRODUCT }, _sum: { qty: true } }),
  ]);
  const moved = (t: "in" | "out") => moves.find((m) => m.type === t)?._sum.crates ?? 0;
  return moved("in") - moved("out") - (sold._sum.qty ?? 0);
}

/**
 * Checks the crate store can cover `crates`, holding a transaction-scoped
 * lock so two writes can't both spend the same stock.
 */
export async function takeCrates(tx: Tx, crates: number) {
  await lockEggStore(tx);
  const stock = await crateStock(tx);
  if (crates > stock) {
    throw new RuleError(
      stock <= 0
        ? "No crates in stock. Record graded crates under Egg inventory first."
        : `Only ${stock} crates in stock.`
    );
  }
  return stock;
}

/**
 * Good eggs collected that aren't sorted yet: Σ(good − withheld) − crates
 * graded × eggs per crate − eggs found cracked at sorting. Opening stock
 * doesn't count — those crates were never collected through the app.
 */
export async function ungradedEggs(tx: Tx) {
  const [prod, graded, perCrate] = await Promise.all([
    tx.eggProduction.aggregate({
      _sum: { eggs: true, cracked: true, rejects: true, withheld: true },
    }),
    tx.eggMove.aggregate({
      where: { type: "in", status: "approved", NOT: { reason: OPENING_STOCK } },
      _sum: { crates: true, cracked: true },
    }),
    eggsPerCrate(tx),
  ]);
  const p = prod._sum;
  const good = (p.eggs ?? 0) - (p.cracked ?? 0) - (p.rejects ?? 0) - (p.withheld ?? 0);
  return { ungraded: good - (graded._sum.crates ?? 0) * perCrate - (graded._sum.cracked ?? 0), perCrate };
}

/** Cracked eggs kept for sale: cracked at collection and found at sorting, less those sold. */
export async function crackedEggs(tx: Tx) {
  const [laid, sorted, sold, perCrate] = await Promise.all([
    tx.eggProduction.aggregate({ _sum: { cracked: true } }),
    tx.eggMove.aggregate({ where: { status: "approved" }, _sum: { cracked: true } }),
    tx.invoice.aggregate({ where: { product: "Cracked eggs" }, _sum: { qty: true } }),
    eggsPerCrate(tx),
  ]);
  return { cracked: (laid._sum.cracked ?? 0) + (sorted._sum.cracked ?? 0) - (sold._sum.qty ?? 0) * perCrate, perCrate };
}

/** Sorting can't account for more eggs — good crates and cracks together — than were collected. */
export async function gradeCrates(tx: Tx, crates: number, cracked = 0) {
  await lockEggStore(tx);
  const { ungraded, perCrate } = await ungradedEggs(tx);
  if (crates * perCrate + cracked > ungraded) {
    const fits = Math.floor(ungraded / perCrate);
    throw new RuleError(
      ungraded <= 0
        ? `No unsorted eggs — record collections under Production first (${perCrate} eggs per crate).`
        : `Only ${ungraded} eggs are unsorted (${fits} crates and ${ungraded - fits * perCrate} pieces at ${perCrate} a crate).`
    );
  }
}

/** Locks the buyer's row so two orders can't both pass the allocation check. */
async function lockCustomer(tx: Tx, customerId: number) {
  const rows = await tx.$queryRaw<{ weeklyCrates: number; name: string; archivedAt: Date | null }[]>`
    SELECT "weeklyCrates", "name", "archivedAt" FROM customers WHERE id = ${customerId} FOR UPDATE`;
  if (!rows[0]) throw new RuleError("That buyer no longer exists.");
  if (rows[0].archivedAt) throw new RuleError(`${rows[0].name} has been removed — restore them on Customers first.`);
  return rows[0];
}

/** Any unpaid balance from an invoice dated before this Monday blocks the buyer. */
export async function assertNoBlockingDebt(tx: Tx, customerId: number, weekStart: string) {
  const unpaid = await tx.invoice.findMany({
    where: { customerId, status: "pending", date: { lt: toDbDate(weekStart) } },
    select: { qty: true, price: true, payments: { select: { amount: true } } },
  });
  if (unpaid.length > 0) {
    const owed = unpaid.reduce(
      (a, v) => a + v.qty * v.price - v.payments.reduce((p, x) => p + x.amount, 0),
      0
    );
    throw new RuleError(`On debt hold: ${naira.format(owed)} unpaid from previous weeks.`);
  }
}

/** Crates this buyer has claimed this week (orders not declined). */
async function weekUsed(tx: Tx, customerId: number, weekStart: string) {
  const used = await tx.eggOrder.aggregate({
    where: { customerId, date: { gte: toDbDate(weekStart) }, status: { not: "declined" } },
    _sum: { crates: true },
  });
  return used._sum.crates ?? 0;
}

async function assertAllocation(
  tx: Tx,
  customer: { weeklyCrates: number; name: string },
  customerId: number,
  crates: number,
  weekStart: string
) {
  const left = allocationLeft(customer.weeklyCrates, await weekUsed(tx, customerId, weekStart));
  if (crates > left) {
    throw new RuleError(
      customer.weeklyCrates === 0
        ? `${customer.name} has no weekly allocation yet — an admin sets it on Customers.`
        : left === 0
          ? `${customer.name} has used this week's full allocation.`
          : `Only ${left} crates left on ${customer.name}'s allocation this week.`
    );
  }
}

/** A buyer's crate price: their own if they have one, else the farm's. */
export async function cratePriceFor(tx: Tx, customerId: number) {
  const [c, s] = await Promise.all([
    tx.customer.findUnique({ where: { id: customerId }, select: { cratePrice: true } }),
    tx.settings.findUnique({ where: { id: 1 } }),
  ]);
  return c?.cratePrice ?? s?.cratePrice ?? 0;
}

/** How long an unpaid order holds its crates before it's released. */
export const HOLD_HOURS = 24;

/**
 * Unpaid orders past their pay-by time stop holding crates. Run before
 * anything reads or checks orders (it's cheap, and there's no scheduler).
 */
export async function releaseUnpaid(db: Tx | typeof prisma, customerId?: number) {
  await db.eggOrder.updateMany({
    where: { status: "pending", paidAt: null, payBy: { lt: new Date() }, ...(customerId ? { customerId } : {}) },
    data: { status: "declined", declineReason: "Not paid in time" },
  });
}

/**
 * What's left to pay for an unpaid order: its total, less what's been paid
 * towards it and the buyer's free credit.
 */
export async function orderDue(tx: Tx, order: { id: number; customerId: number; crates: number; price: number | null }) {
  const total = order.crates * (order.price ?? 0);
  const paid = await paidTowardsOrder(tx, order.id);
  return Math.max(0, total - paid - Math.max(0, await availableCredit(tx, order.customerId)));
}

/**
 * Marks an unpaid order paid if the buyer's free credit covers it — after
 * they pay, or straight away when credit already covers it. From then on
 * that credit is held for the order and it goes to the farm.
 */
export async function markOrderPaidIfCovered(tx: Tx, orderId: number) {
  const order = await tx.eggOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "pending" || order.paidAt) return false;
  await lockCustomer(tx, order.customerId);
  if ((await orderDue(tx, order)) > 0) return false;
  const r = await tx.eggOrder.updateMany({
    where: { id: orderId, status: "pending", paidAt: null },
    data: { paidAt: new Date(), payBy: null },
  });
  return r.count > 0;
}

/**
 * Places an order under both rules, locking in today's crate price. It is
 * unpaid until the buyer pays (or their credit covers it) and holds its
 * crates for HOLD_HOURS; only paid orders reach the farm. Used by the
 * portal and by staff.
 */
export async function placeEggOrder(customerId: number, crates: number, notes = "") {
  const today = farmToday();
  const weekStart = weekStartOf(today);
  return prisma.$transaction(async (tx) => {
    const customer = await lockCustomer(tx, customerId);
    await releaseUnpaid(tx, customerId);
    await assertNoBlockingDebt(tx, customerId, weekStart);
    await assertAllocation(tx, customer, customerId, crates, weekStart);
    const price = await cratePriceFor(tx, customerId);
    if (!price) throw new RuleError("The farm hasn't set a crate price yet — call the farm office.");
    const order = await tx.eggOrder.create({
      data: {
        date: toDbDate(today),
        customerId,
        crates,
        notes,
        price,
        payBy: new Date(Date.now() + HOLD_HOURS * 3600_000),
      },
    });
    const paid = await markOrderPaidIfCovered(tx, order.id);
    return { order, paid, due: paid ? 0 : await orderDue(tx, order) };
  });
}

/**
 * Fulfil → invoice, atomically, at the price locked on the order. Only a
 * paid order can be fulfilled: the invoice is settled from the credit the
 * buyer paid in, so the farm never ships unpaid crates — unless an admin
 * chooses `withBalance` on a part-paid order: the invoice then shows the
 * balance due. `crates` fulfils part of it; the rest stays pending as its
 * own order.
 */
export async function fulfilEggOrder(orderId: number, crates: number | undefined, by: string, withBalance = false) {
  const today = farmToday();
  return prisma.$transaction(async (tx) => {
    const order = await tx.eggOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "pending") {
      throw new RuleError("This order has already been handled.");
    }
    if (!order.paidAt && !(withBalance && (await paidTowardsOrder(tx, order.id)) > 0)) {
      throw new RuleError("This order hasn't been paid for — the buyer pays before it can be fulfilled.");
    }
    const qty = crates ?? order.crates;
    if (qty < 1 || qty > order.crates) {
      throw new RuleError(`Fulfil between 1 and ${order.crates} crates.`);
    }
    const customer = await lockCustomer(tx, order.customerId);
    const price = order.price ?? (await cratePriceFor(tx, order.customerId));
    if (!price) throw new RuleError("Set the crate price first.");

    // Conditional update: a concurrent fulfil/decline makes this a no-op.
    const flipped = await tx.eggOrder.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "fulfilled", crates: qty, price },
    });
    if (flipped.count === 0) throw new RuleError("This order has already been handled.");
    await takeCrates(tx, qty);

    if (qty < order.crates) {
      // The rest of the order waits for more stock — still paid for.
      await tx.eggOrder.create({
        data: {
          date: order.date,
          customerId: order.customerId,
          crates: order.crates - qty,
          notes: order.notes,
          price,
          paidAt: order.paidAt,
          payBy: order.paidAt ? null : new Date(Date.now() + HOLD_HOURS * 3600_000),
        },
      });
    }

    const invoice = await tx.invoice.create({
      data: {
        date: toDbDate(today),
        customerId: order.customerId,
        name: customer.name,
        product: EGG_PRODUCT,
        qty,
        price,
        orderId: order.id,
      },
    });
    await applyCredit(tx, invoice.id, today, by);
    // The order's money must cover its invoice; if credit went elsewhere, stop.
    const paid = await tx.payment.aggregate({ where: { invoiceId: invoice.id }, _sum: { amount: true } });
    if (!withBalance && (paid._sum.amount ?? 0) < qty * price) {
      throw new RuleError(
        `${customer.name}'s credit no longer covers this order — check their credit on Customers before fulfilling.`
      );
    }
    return { invoiceId: invoice.id, remainder: order.crates - qty };
  });
}

/**
 * A counter sale of crates to a registered buyer. It goes through the same
 * gate as an order — allocation, debt hold, stock — and is recorded as an
 * order fulfilled on the spot, at the crate price (an admin may set
 * another price).
 */
export async function sellCratesToBuyer(
  tx: Tx,
  input: { customerId: number; crates: number; price?: number; today: string; by: string }
) {
  const weekStart = weekStartOf(input.today);
  const customer = await lockCustomer(tx, input.customerId);
  await assertNoBlockingDebt(tx, input.customerId, weekStart);
  await assertAllocation(tx, customer, input.customerId, input.crates, weekStart);
  const price = input.price ?? (await cratePriceFor(tx, input.customerId));
  if (!price) throw new RuleError("Set the crate price first.");
  await takeCrates(tx, input.crates);
  const order = await tx.eggOrder.create({
    data: {
      date: toDbDate(input.today),
      customerId: input.customerId,
      crates: input.crates,
      status: "fulfilled",
      notes: "Counter sale",
      price,
    },
  });
  const invoice = await tx.invoice.create({
    data: {
      date: toDbDate(input.today),
      customerId: input.customerId,
      name: customer.name,
      product: EGG_PRODUCT,
      qty: input.crates,
      price,
      orderId: order.id,
    },
  });
  await applyCredit(tx, invoice.id, input.today, input.by);
  return invoice;
}
