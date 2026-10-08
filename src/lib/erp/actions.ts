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
import { takeBags, takeFinishedKg, takeIngredients } from "@/lib/feed-stock";
import { takeFromLocation } from "@/lib/inv-stock";
import { createInvite } from "@/lib/invites";
import { AuthError, ForbiddenError, requireAdmin, requireStaff } from "@/lib/session";

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
type Opts = {
  /** Money, settings, corrections and people: admins only. */
  admin?: boolean;
};

function act<S extends z.ZodType>(
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<unknown>,
  opts: Opts = {}
) {
  const inner = actReturning(
    schema,
    async (input, ctx) => {
      await run(input, ctx);
      return undefined;
    },
    opts
  );
  return async (raw: z.input<S>): Promise<ActionResult> => inner(raw);
}

/** A write that hands a value back to the client (e.g. an invite link). */
function actReturning<S extends z.ZodType, R>(
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<R>,
  opts: Opts = {}
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    let data: R;
    try {
      const session = opts.admin ? await requireAdmin() : await requireStaff();
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
  if (e instanceof AuthError || e instanceof ForbiddenError || e instanceof RuleError) {
    return e.message;
  }
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

export const markPaid = act(
  id,
  (invoiceId, { today }) =>
    prisma.invoice.updateMany({
      where: { id: invoiceId, status: "pending" },
      data: { status: "paid", paidAt: toDbDate(today) },
    }),
  { admin: true }
);

/** Undo a mistaken "mark paid". */
export const markUnpaid = act(
  id,
  (invoiceId) =>
    prisma.invoice.updateMany({
      where: { id: invoiceId, status: "paid" },
      data: { status: "pending", paidAt: null },
    }),
  { admin: true }
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

export const setCratePrice = act(
  z.number().positive().finite().transform(Math.round),
  (cratePrice) =>
    prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, cratePrice },
      update: { cratePrice },
    }),
  { admin: true }
);

export const declineRequest = act(id, async (reqId) => {
  const r = await prisma.feedRequest.updateMany({
    where: { id: reqId, status: "pending" },
    data: { status: "declined" },
  });
  if (r.count === 0) throw new RuleError("This request has already been handled.");
});

// ── People & invites ────────────────────────────────────────────────────────

const email = z.email("Enter a valid email.").max(200);

/** Returns the link path; the client prefixes its own origin. */
export const inviteStaff = actReturning(
  z.object({ name: text, email, role: z.enum(["admin", "staff"]) }),
  ({ name, email, role }, { staffId }) => createInvite({ name, email, role, createdById: staffId }),
  { admin: true }
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

export const revokeInvite = act(
  id,
  (inviteId) =>
    prisma.invite.updateMany({
      where: { id: inviteId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  { admin: true }
);

/** Promote or demote a team member. You can't change your own role. */
export const setStaffRole = act(
  z.object({ userId: text, role: z.enum(["admin", "staff"]) }),
  async ({ userId, role }, { staffId }) => {
    if (userId === staffId) throw new RuleError("You can't change your own role.");
    const r = await prisma.user.updateMany({
      where: { id: userId, role: { in: ["admin", "staff"] } },
      data: { role },
    });
    if (r.count === 0) throw new RuleError("That person isn't on the team.");
  },
  { admin: true }
);

/**
 * Remove (or restore) someone's access — staff or buyer. Disabling ends
 * their sessions at once; their records stay.
 */
export const setUserDisabled = act(
  z.object({ userId: text, disabled: z.boolean() }),
  async ({ userId, disabled }, { staffId }) => {
    if (userId === staffId) throw new RuleError("You can't remove your own access.");
    await prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id: userId }, data: { disabled } });
      if (r.count === 0) throw new RuleError("That login no longer exists.");
      if (disabled) await tx.session.deleteMany({ where: { userId } });
    });
  },
  { admin: true }
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
async function drawAtLayers(
  tx: Tx,
  itemId: number,
  qty: number,
  today: string,
  by: string,
  link: { vaccinationId: number } | { medicationId: number }
) {
  if (qty <= 0) return;
  await takeFromLocation(tx, itemId, "layers", qty);
  await tx.invMove.create({
    data: { date: toDbDate(today), itemId, fromLoc: "layers", toLoc: null, qty, by, ...link },
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
      const used = v.status === "done" ? v.qtyUsed : 0;
      const rec = await tx.vaccination.create({
        data: {
          date: toDbDate(today),
          itemId: v.item,
          batchCode: v.batch,
          houseCode: v.house,
          route: v.route,
          qtyUsed: used,
          status: v.status,
        },
      });
      await drawAtLayers(tx, v.item, used, today, staffName, { vaccinationId: rec.id });
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
      const rec = await tx.medication.create({
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
      await drawAtLayers(tx, m.item, m.qtyUsed, today, staffName, { medicationId: rec.id });
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

// ── Corrections (admin) ─────────────────────────────────────────────────────
// Catalogs are edited in place. Ledger entries are deleted and re-entered,
// and a delete is refused if it would leave any stock below zero.

export const updateCustomer = act(
  z.object({ id, name: text, phone: optText, alloc: whole }),
  ({ id, name, phone, alloc }) =>
    prisma.customer.update({ where: { id }, data: { name, phone, weeklyCrates: alloc } }),
  { admin: true }
);

export const updateIngredient = act(
  z.object({
    id,
    name: text,
    cat: z.enum(["energy", "protein", "fibre", "mineral", "additive"]),
    reorder: level,
  }),
  ({ id, name, cat, reorder }) =>
    prisma.ingredient.update({ where: { id }, data: { name, category: cat, reorderKg: reorder } }),
  { admin: true }
);

/** Bag size and SKU stay fixed: stock is counted in them. */
export const updateProduct = act(
  z.object({
    id,
    name: text,
    price: z.number().positive("Enter a price above 0.").finite().transform(Math.round),
  }),
  ({ id, name, price }) => prisma.feedProduct.update({ where: { id }, data: { name, price } }),
  { admin: true }
);

export const updateHouse = act(
  z.object({ code: text, capacity: whole.positive() }),
  ({ code, capacity }) =>
    prisma.$transaction(async (tx) => {
      const room = await houseRoom(tx, code);
      const birds = (await tx.house.findUniqueOrThrow({ where: { code } })).capacity - room;
      if (capacity < birds) {
        throw new RuleError(`${code} holds ${birds.toLocaleString("en-US")} birds now.`);
      }
      await tx.house.update({ where: { code }, data: { capacity } });
    }),
  { admin: true }
);

export const updateInvItem = act(
  z.object({
    id,
    name: text,
    cat: z.enum(["medication", "equipment", "packaging", "supplies"]),
    unit: text,
    reorder: level,
    cost: naira,
  }),
  ({ id, name, cat, unit, reorder, cost }) =>
    prisma.invItem.update({ where: { id }, data: { name, category: cat, unit, reorder, cost } }),
  { admin: true }
);

const ENTRY_KINDS = [
  "production",
  "eggMove",
  "feedUse",
  "water",
  "layersFeedDelivery",
  "vaccination",
  "medication",
  "delivery",
  "run",
  "feedSale",
  "invMove",
  "invoice",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Runs a stock check, replacing its "only N left" wording with `why`. */
async function refuseIfShort(check: Promise<unknown>, why: string) {
  try {
    await check;
  } catch (e) {
    if (e instanceof RuleError) throw new RuleError(why);
    throw e;
  }
}

export const deleteEntry = act(
  z.object({ kind: z.enum(ENTRY_KINDS), id }),
  ({ kind, id }) =>
    prisma.$transaction(async (tx) => {
      const gone = () => new RuleError("That entry no longer exists.");
      switch (kind) {
        case "production":
          if ((await tx.eggProduction.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "feedUse":
          if ((await tx.feedUse.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "water":
          if ((await tx.waterLog.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "layersFeedDelivery":
          if ((await tx.layersFeedDelivery.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "vaccination":
          // Its stock draw goes with it (cascade), returning the doses.
          if ((await tx.vaccination.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "medication":
          if ((await tx.medication.deleteMany({ where: { id } })).count === 0) throw gone();
          return;
        case "eggMove": {
          const m = await tx.eggMove.findUnique({ where: { id } });
          if (!m) throw gone();
          // Removing crates that came in can't leave the store short.
          if (m.type === "in") {
            await refuseIfShort(
              takeCrates(tx, m.crates),
              "Those crates have already been sold or moved out — delete those first."
            );
          }
          await tx.eggMove.delete({ where: { id } });
          return;
        }
        case "delivery": {
          const d = await tx.ingredientDelivery.findUnique({ where: { id } });
          if (!d) throw gone();
          await refuseIfShort(
            takeIngredients(tx, [[d.ingredientId, d.kg]]),
            "Some of this delivery has already gone into production runs — delete those runs first."
          );
          await tx.ingredientDelivery.delete({ where: { id } });
          return;
        }
        case "run": {
          const r = await tx.productionRun.findUnique({ where: { id } });
          if (!r) throw gone();
          await takeFinishedKg(tx, r.productId, r.outputKg);
          await tx.productionRun.delete({ where: { id } }); // lines cascade
          return;
        }
        case "feedSale": {
          const sale = await tx.feedSale.findUnique({ where: { id } });
          if (!sale) throw gone();
          await tx.feedSale.delete({ where: { id } });
          // A sale that fulfilled a request puts the request back in the queue.
          if (sale.requestId) {
            await tx.feedRequest.update({ where: { id: sale.requestId }, data: { status: "pending" } });
          }
          return;
        }
        case "invMove": {
          const m = await tx.invMove.findUnique({ where: { id } });
          if (!m) throw gone();
          if (m.vaccinationId || m.medicationId) {
            throw new RuleError("This is a health record's draw — delete the health record instead.");
          }
          // Undoing a move takes the quantity back out of where it went.
          if (m.toLoc) {
            await refuseIfShort(
              takeFromLocation(tx, m.itemId, m.toLoc, m.qty),
              `Some of it has already been moved on from ${m.toLoc} — undo those moves first.`
            );
          }
          await tx.invMove.delete({ where: { id } });
          return;
        }
        case "invoice": {
          const v = await tx.invoice.findUnique({ where: { id } });
          if (!v) throw gone();
          if (v.status === "paid") throw new RuleError("Mark it unpaid first, then delete it.");
          await tx.invoice.delete({ where: { id } });
          // An order's invoice going away puts the order back to pending.
          if (v.orderId) {
            await tx.eggOrder.update({ where: { id: v.orderId }, data: { status: "pending" } });
          }
          return;
        }
      }
    }),
  { admin: true }
);
