"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { farmToday, toDbDate } from "@/lib/dates";
import {
  EGG_PRODUCT,
  fulfilEggOrder,
  placeEggOrder,
  RuleError,
  takeCrates,
  type Tx,
} from "@/lib/egg-orders";
import { DIVISIONS, divisionBuyer } from "@/lib/erp/divisions";
import { takeBags, takeIngredients } from "@/lib/feed-stock";
import { takeFromLocation } from "@/lib/inv-stock";
import { createInvite } from "@/lib/invites";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * Every ERP write. Each one re-checks the staff session (actions are plain
 * POST endpoints), validates its input, writes, and refreshes the router so
 * the layout reloads the ledgers and every derived figure moves.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  /** `signedOut`: the session is gone — the client should go to sign-in. */
  | { ok: false; error: string; signedOut?: boolean };

const id = z.number().int().positive();
const whole = z.number().int().nonnegative();
const qty = z.number().positive().finite();
const level = z.number().nonnegative().finite();
// Money is whole naira; a stray decimal from a form is rounded, not rejected.
const naira = z.number().nonnegative().finite().transform(Math.round);
const rate = z.number().nonnegative().finite();
const text = z.string().trim().min(1).max(200);
const optText = z.string().trim().max(200);
const code = z.string().trim().toUpperCase().min(1).max(40);

type Ctx = { today: string; staffId: string; staffName: string };

/** A write whose result the client doesn't need. */
function act<S extends z.ZodType>(
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<unknown>
) {
  const inner = actReturning(schema, async (input, ctx) => {
    await run(input, ctx);
    return undefined;
  });
  return async (raw: z.input<S>): Promise<ActionResult> => inner(raw);
}

/** A write that hands a value back to the client (e.g. an invite link). */
function actReturning<S extends z.ZodType, R>(
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<R>
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    let data: R;
    try {
      const session = await requireStaff();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue.path.join(".");
        return { ok: false, error: field ? `${field}: ${issue.message}` : issue.message };
      }
      data = await run(parsed.data, {
        today: farmToday(),
        staffId: session.user.id,
        staffName: session.user.name,
      });
    } catch (e) {
      return { ok: false, error: describe(e), signedOut: e instanceof AuthError };
    }
    refresh();
    return { ok: true, data };
  };
}

function describe(e: unknown): string {
  if (e instanceof AuthError || e instanceof RuleError) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "That code is already in use.";
    if (e.code === "P2003") return "A linked record doesn't exist.";
  }
  console.error(e);
  return "Couldn't save. Please try again.";
}

// ── Workflows ───────────────────────────────────────────────────────────────

export const fulfilOrder = act(id, (orderId) => fulfilEggOrder(orderId));

export const declineOrder = act(id, async (orderId) => {
  const r = await prisma.eggOrder.updateMany({
    where: { id: orderId, status: "pending" },
    data: { status: "declined" },
  });
  if (r.count === 0) throw new RuleError("This order has already been handled.");
});

export const markPaid = act(id, (invoiceId, { today }) =>
  prisma.invoice.updateMany({
    where: { id: invoiceId, status: "pending" },
    data: { status: "paid", paidAt: toDbDate(today) },
  })
);

export const fulfilRequest = act(id, (reqId, { today }) =>
  prisma.$transaction(async (tx) => {
    const flipped = await tx.feedRequest.updateMany({
      where: { id: reqId, status: "pending" },
      data: { status: "fulfilled" },
    });
    if (flipped.count === 0) throw new RuleError("This request has already been handled.");
    const q = await tx.feedRequest.findUniqueOrThrow({
      where: { id: reqId },
      include: { product: true },
    });
    if (!q.product.price) throw new RuleError(`Set a price for ${q.product.name} first.`);
    await takeBags(tx, q.productId, q.bags);
    await tx.feedSale.create({
      data: {
        date: toDbDate(today),
        productId: q.productId,
        channel: "internal",
        buyer: divisionBuyer(q.division),
        bags: q.bags,
        price: q.product.price,
        requestId: q.id,
      },
    });
  })
);

export const setCratePrice = act(z.number().positive().finite().transform(Math.round), (cratePrice) =>
  prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, cratePrice },
    update: { cratePrice },
  })
);

// ── People & invites ────────────────────────────────────────────────────────

const email = z.email("Enter a valid email.").max(200);

/** Returns the link path; the client prefixes its own origin. */
export const inviteStaff = actReturning(
  z.object({ name: text, email }),
  ({ name, email }, { staffId }) =>
    createInvite({ name, email, role: "staff", createdById: staffId })
);

export const inviteBuyer = actReturning(
  z.object({ customerId: id, email }),
  async ({ customerId, email }, { staffId }) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new RuleError("That buyer no longer exists.");
    return createInvite({
      name: customer.name,
      email,
      role: "customer",
      customerId,
      createdById: staffId,
    });
  }
);

export const revokeInvite = act(id, (inviteId) =>
  prisma.invite.updateMany({
    where: { id: inviteId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
);

// ── Customers & sales ───────────────────────────────────────────────────────

/**
 * New buyer. With an email, their portal invite is created in the same step
 * and its link returned; without one, invite them later from their row.
 */
export const addCustomer = actReturning(
  z.object({
    name: text,
    phone: optText,
    alloc: whole,
    email: z.union([z.email("Enter a valid email, or leave it blank."), z.literal("")]),
  }),
  async ({ name, phone, alloc, email }, { staffId }) => {
    // Check first, so a taken email doesn't leave a buyer created half-way.
    if (email && (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))) {
      throw new RuleError(`${email.toLowerCase()} already has a login.`);
    }
    const customer = await prisma.customer.create({
      data: { name, phone, weeklyCrates: alloc },
    });
    if (!email) return { path: null };
    return createInvite({
      name,
      email,
      role: "customer",
      customerId: customer.id,
      createdById: staffId,
    });
  }
);

/** Staff ordering on a buyer's behalf — same rules as the portal. */
export const addOrder = act(
  z.object({ cust: id, crates: whole.positive() }),
  ({ cust, crates }) => placeEggOrder(cust, crates)
);

export const addInvoice = act(
  z.object({
    cust: id.nullable(),
    name: text,
    product: text,
    qty: whole.positive(),
    price: naira,
    status: z.enum(["paid", "pending"]),
    unit: optText.optional(),
  }),
  (v, { today }) =>
    prisma.$transaction(async (tx) => {
      if (v.product === EGG_PRODUCT) await takeCrates(tx, v.qty);
      await tx.invoice.create({
        data: {
          date: toDbDate(today),
          customerId: v.cust,
          name: v.name,
          product: v.product,
          qty: v.qty,
          unit: v.unit || null,
          price: v.price,
          status: v.status,
          paidAt: v.status === "paid" ? toDbDate(today) : null,
        },
      });
    })
);

// ── Layers ──────────────────────────────────────────────────────────────────

export const addProduction = act(
  z
    .object({ house: text, eggs: whole.positive(), cracked: whole, rejects: whole.default(0) })
    .refine((p) => p.cracked + p.rejects <= p.eggs, "Cracked + rejects can't exceed eggs collected."),
  ({ house, eggs, cracked, rejects }, { today }) =>
    prisma.eggProduction.create({
      data: { date: toDbDate(today), houseCode: house, eggs, cracked, rejects },
    })
);

export const addEggMove = act(
  z.object({ type: z.enum(["in", "out"]), crates: whole.positive() }),
  ({ type, crates }, { today }) =>
    prisma.$transaction(async (tx) => {
      if (type === "out") await takeCrates(tx, crates);
      await tx.eggMove.create({ data: { date: toDbDate(today), type, crates } });
    })
);

export const logFeedUse = act(z.object({ house: text, kg: qty }), ({ house, kg }, { today }) =>
  prisma.feedUse.create({ data: { date: toDbDate(today), houseCode: house, kg } })
);

/** Active birds already in a house, with the house row locked for the check. */
async function houseRoom(tx: Tx, code: string) {
  const rows = await tx.$queryRaw<{ capacity: number }[]>`
    SELECT capacity FROM houses WHERE code = ${code} FOR UPDATE`;
  if (!rows[0]) throw new RuleError(`House ${code} doesn't exist.`);
  const batches = await tx.batch.findMany({
    where: { houseCode: code, status: "active" },
    select: { birds: true, mortality: true },
  });
  const birds = batches.reduce((a, b) => a + b.birds - b.mortality, 0);
  return rows[0].capacity - birds;
}

export const addBatch = act(
  z.object({
    batch: code,
    breed: text,
    supplier: text,
    received: z.iso.date(),
    birds: whole.positive(),
    mortality: whole,
    /** "—" places the batch without a house. */
    house: text,
    st: z.enum(["active", "closed"]),
  }),
  (b) =>
    prisma.$transaction(async (tx) => {
      const houseCode = b.house === "—" ? null : b.house;
      if (houseCode) {
        const room = await houseRoom(tx, houseCode);
        if (b.birds > room) {
          throw new RuleError(
            room <= 0
              ? `${houseCode} is full.`
              : `${houseCode} only has room for ${room.toLocaleString("en-US")} more birds.`
          );
        }
      }
      await tx.batch.create({
        data: {
          code: b.batch,
          breed: b.breed,
          supplier: b.supplier,
          received: toDbDate(b.received),
          birds: b.birds,
          mortality: b.mortality,
          houseCode,
          status: b.st,
        },
      });
    })
);

/** Deaths and culls are added to the batch's running mortality. */
export const recordMortality = act(
  z.object({ batch: text, birds: whole.positive() }),
  ({ batch, birds }) =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ birds: number; mortality: number; status: string }[]>`
        SELECT birds, mortality, status::text AS status FROM batches WHERE code = ${batch} FOR UPDATE`;
      const b = rows[0];
      if (!b) throw new RuleError("That batch no longer exists.");
      if (b.status !== "active") throw new RuleError("That batch is closed.");
      const alive = b.birds - b.mortality;
      if (birds > alive) throw new RuleError(`Only ${alive.toLocaleString("en-US")} birds left in ${batch}.`);
      await tx.batch.update({ where: { code: batch }, data: { mortality: { increment: birds } } });
    })
);

/** Depopulated: the batch leaves its house and stops counting as in lay. */
export const closeBatch = act(text, async (batch) => {
  const r = await prisma.batch.updateMany({
    where: { code: batch, status: "active" },
    data: { status: "closed", houseCode: null },
  });
  if (r.count === 0) throw new RuleError("That batch is already closed.");
});

export const addHouse = act(z.object({ code, capacity: whole.positive() }), (h) =>
  prisma.house.create({ data: h })
);

export const addLayersFeedDelivery = act(
  z.object({ supplier: text, kg: qty }),
  ({ supplier, kg }, { today }) =>
    prisma.layersFeedDelivery.create({ data: { date: toDbDate(today), supplier, kg } })
);

export const addWaterLog = act(
  z.object({ house: text, litres: qty }),
  ({ house, litres }, { today }) =>
    prisma.waterLog.create({ data: { date: toDbDate(today), houseCode: house, litres } })
);

/** Health records draw what they used from the Layers store location. */
async function useAtLayers(tx: Tx, itemId: number, qty: number, today: string, by: string) {
  if (qty <= 0) return;
  await takeFromLocation(tx, itemId, "layers", qty);
  await tx.invMove.create({
    data: { date: toDbDate(today), itemId, fromLoc: "layers", toLoc: null, qty, by },
  });
}

export const addVaccination = act(
  z.object({
    item: id,
    batch: text,
    house: text,
    route: text,
    qtyUsed: level,
    status: z.enum(["done", "due", "overdue"]),
  }),
  (v, { today, staffName }) =>
    prisma.$transaction(async (tx) => {
      // A scheduled (due) dose hasn't used anything yet.
      if (v.status === "done") await useAtLayers(tx, v.item, v.qtyUsed, today, staffName);
      await tx.vaccination.create({
        data: {
          date: toDbDate(today),
          itemId: v.item,
          batchCode: v.batch,
          houseCode: v.house,
          route: v.route,
          qtyUsed: v.status === "done" ? v.qtyUsed : 0,
          status: v.status,
        },
      });
    })
);

export const addMedication = act(
  z.object({
    item: id,
    reason: text,
    batch: text,
    dosage: text,
    qtyUsed: level,
    status: z.enum(["ongoing", "completed"]),
  }),
  (m, { today, staffName }) =>
    prisma.$transaction(async (tx) => {
      await useAtLayers(tx, m.item, m.qtyUsed, today, staffName);
      await tx.medication.create({
        data: {
          date: toDbDate(today),
          itemId: m.item,
          reason: m.reason,
          batchCode: m.batch,
          dosage: m.dosage,
          qtyUsed: m.qtyUsed,
          status: m.status,
        },
      });
    })
);

// ── Feed mill ───────────────────────────────────────────────────────────────

export const addIngredient = act(
  z.object({
    code,
    name: text,
    cat: z.enum(["energy", "protein", "fibre", "mineral", "additive"]),
    reorder: level,
  }),
  (i) =>
    prisma.ingredient.create({
      data: { code: i.code, name: i.name, category: i.cat, reorderKg: i.reorder },
    })
);

export const addDelivery = act(
  z.object({ ing: id, kg: qty, price: rate }),
  ({ ing, kg, price }, { today }) =>
    prisma.ingredientDelivery.create({
      data: { date: toDbDate(today), ingredientId: ing, kg, pricePerKg: price },
    })
);

export const addProduct = act(
  z.object({
    sku: code,
    name: text,
    bag: qty,
    price: z.number().positive("Enter a price above 0.").finite().transform(Math.round),
  }),
  (p) =>
    prisma.feedProduct.create({
      data: { sku: p.sku, name: p.name, bagKg: p.bag, price: p.price },
    })
);

export const addRun = act(
  z.object({
    run: code,
    product: id,
    operator: text,
    output: qty,
    lines: z.array(z.tuple([id, qty, rate])).min(1),
  }),
  (r, { today }) =>
    prisma.$transaction(async (tx) => {
      await takeIngredients(tx, r.lines.map(([ing, kg]) => [ing, kg]));
      await tx.productionRun.create({
        data: {
          code: r.run,
          date: toDbDate(today),
          productId: r.product,
          operator: r.operator,
          outputKg: r.output,
          lines: {
            create: r.lines.map(([ingredientId, kg, pricePerKg]) => ({
              ingredientId,
              kg,
              pricePerKg,
            })),
          },
        },
      });
    })
);

export const addFeedSale = act(
  z.object({
    product: id,
    channel: z.enum(["internal", "external"]),
    buyer: text,
    bags: whole.positive(),
    price: naira,
  }),
  (s, { today }) =>
    prisma.$transaction(async (tx) => {
      // Internal buyers are divisions, spelled the way their stock is tracked.
      let buyer = s.buyer;
      if (s.channel === "internal") {
        const d = DIVISIONS.find((x) => x === s.buyer.trim().toLowerCase());
        if (!d) throw new RuleError("Internal sales go to a division: Layers, Broilers or Ruminants.");
        buyer = divisionBuyer(d);
      }
      await takeBags(tx, s.product, s.bags);
      await tx.feedSale.create({
        data: {
          date: toDbDate(today),
          productId: s.product,
          channel: s.channel,
          buyer,
          bags: s.bags,
          price: s.price,
        },
      });
    })
);

export const addFeedRequest = act(
  z.object({ division: z.enum(DIVISIONS), product: id, bags: whole.positive(), by: text }),
  (q, { today }) =>
    prisma.feedRequest.create({
      data: {
        date: toDbDate(today),
        division: q.division,
        productId: q.product,
        bags: q.bags,
        requestedBy: q.by,
      },
    })
);

// ── Central inventory ───────────────────────────────────────────────────────

export const addInvItem = act(
  z.object({
    sku: code,
    name: text,
    cat: z.enum(["medication", "equipment", "packaging", "supplies"]),
    unit: text,
    reorder: level,
    cost: naira,
  }),
  (i) =>
    prisma.invItem.create({
      data: {
        sku: i.sku,
        name: i.name,
        category: i.cat,
        unit: i.unit,
        reorder: i.reorder,
        cost: i.cost,
      },
    })
);

export const addInvMove = act(
  z
    .object({
      item: id,
      from: text.nullable(),
      to: text.nullable(),
      qty,
      by: text,
    })
    .refine((m) => m.from !== m.to, "From and to must differ.")
    .refine((m) => m.from !== null || m.to !== null, "A receipt goes into a location, not straight to used."),
  (m, { today }) =>
    prisma.$transaction(async (tx) => {
      if (m.from !== null) await takeFromLocation(tx, m.item, m.from, m.qty);
      await tx.invMove.create({
        data: {
          date: toDbDate(today),
          itemId: m.item,
          fromLoc: m.from,
          toLoc: m.to,
          qty: m.qty,
          by: m.by,
        },
      });
    })
);
