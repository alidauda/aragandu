import "server-only";

import { prisma } from "@/lib/db";
import { farmToday, toDbDate, weekStartOf } from "@/lib/dates";
import { applyCredit } from "@/lib/money";
import { allocationLeft, naira } from "@/lib/orders";
import { RuleError, type Tx } from "@/lib/rules";

export { RuleError, type Tx };

/** The invoice product that draws on the crate store. */
export const EGG_PRODUCT = "Eggs (crates)";

/** The egg-move reason an admin uses for crates already on the shelf at go-live. */
export const OPENING_STOCK = "opening stock";

// Any number works; it only has to be the same for every crate-store write.
const EGG_STOCK_LOCK = 4242;

const lockEggStore = (tx: Tx) =>
  tx.$queryRaw`SELECT pg_advisory_xact_lock(${EGG_STOCK_LOCK})::text`;

async function eggsPerCrate(tx: Tx) {
  return (await tx.settings.findUnique({ where: { id: 1 } }))?.eggsPerCrate ?? 30;
}

/** Crates on the shelf: approved graded-in − approved outs − crates sold. */
async function crateStock(tx: Tx) {
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
 * Good eggs collected that aren't in a crate yet: Σ(good − withheld) −
 * crates graded × eggs per crate. Opening stock doesn't count — those
 * crates were never collected through the app.
 */
export async function ungradedEggs(tx: Tx) {
  const [prod, graded, perCrate] = await Promise.all([
    tx.eggProduction.aggregate({
      _sum: { eggs: true, cracked: true, rejects: true, withheld: true },
    }),
    tx.eggMove.aggregate({
      where: { type: "in", status: "approved", NOT: { reason: OPENING_STOCK } },
      _sum: { crates: true },
    }),
    eggsPerCrate(tx),
  ]);
  const p = prod._sum;
  const good = (p.eggs ?? 0) - (p.cracked ?? 0) - (p.rejects ?? 0) - (p.withheld ?? 0);
  return { ungraded: good - (graded._sum.crates ?? 0) * perCrate, perCrate };
}

/** Grading in can't pack more crates than the eggs collected allow. */
export async function gradeCrates(tx: Tx, crates: number) {
  await lockEggStore(tx);
  const { ungraded, perCrate } = await ungradedEggs(tx);
  const fits = Math.floor(ungraded / perCrate);
  if (crates > fits) {
    throw new RuleError(
      fits <= 0
        ? `No ungraded eggs to pack — record collections under Production first (${perCrate} eggs per crate).`
        : `Only ${fits} crates' worth of eggs are ungraded (${ungraded} eggs at ${perCrate} a crate).`
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

async function currentCratePrice(tx: Tx) {
  const s = await tx.settings.findUnique({ where: { id: 1 } });
  return s?.cratePrice ?? 0;
}

/**
 * Places an order under both rules, locking in today's crate price — the
 * price the buyer sees and agrees to. Used by the portal and by staff.
 */
export async function placeEggOrder(customerId: number, crates: number, notes = "") {
  const today = farmToday();
  const weekStart = weekStartOf(today);
  return prisma.$transaction(async (tx) => {
    const customer = await lockCustomer(tx, customerId);
    await assertNoBlockingDebt(tx, customerId, weekStart);
    await assertAllocation(tx, customer, customerId, crates, weekStart);
    const price = await currentCratePrice(tx);
    return tx.eggOrder.create({
      data: { date: toDbDate(today), customerId, crates, notes, price: price || null },
    });
  });
}

/**
 * Fulfil → invoice, atomically, at the price locked on the order. `crates`
 * fulfils part of it; the rest stays pending as its own order. An order
 * from an earlier week has expired — it counted against that week's
 * allocation, so it can only be declined.
 */
export async function fulfilEggOrder(orderId: number, crates: number | undefined, by: string) {
  const today = farmToday();
  const weekStart = weekStartOf(today);
  return prisma.$transaction(async (tx) => {
    const order = await tx.eggOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "pending") {
      throw new RuleError("This order has already been handled.");
    }
    if (order.date < toDbDate(weekStart)) {
      throw new RuleError("This order is from an earlier week and has expired — decline it.");
    }
    const qty = crates ?? order.crates;
    if (qty < 1 || qty > order.crates) {
      throw new RuleError(`Fulfil between 1 and ${order.crates} crates.`);
    }
    const customer = await lockCustomer(tx, order.customerId);
    await assertNoBlockingDebt(tx, order.customerId, weekStart);
    const price = order.price ?? (await currentCratePrice(tx));
    if (!price) throw new RuleError("Set the crate price first.");

    // Conditional update: a concurrent fulfil/decline makes this a no-op.
    const flipped = await tx.eggOrder.updateMany({
      where: { id: orderId, status: "pending" },
      data: { status: "fulfilled", crates: qty, price },
    });
    if (flipped.count === 0) throw new RuleError("This order has already been handled.");
    await takeCrates(tx, qty);

    if (qty < order.crates) {
      // The rest of the order waits for more stock.
      await tx.eggOrder.create({
        data: {
          date: order.date,
          customerId: order.customerId,
          crates: order.crates - qty,
          notes: order.notes,
          price,
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
  const price = input.price ?? (await currentCratePrice(tx));
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
