"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { farmToday, toDbDate } from "@/lib/dates";
import { fulfilEggOrder, placeEggOrder, RuleError } from "@/lib/egg-orders";
import { AuthError, requireStaff } from "@/lib/session";
import { createCredentialUser } from "@/lib/users";

/**
 * Every ERP write. Each one re-checks the staff session (actions are plain
 * POST endpoints), validates its input, writes, and refreshes the router so
 * the layout reloads the ledgers and every derived figure moves.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

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

function act<S extends z.ZodType>(
  schema: S,
  run: (input: z.output<S>, ctx: { today: string }) => Promise<unknown>
) {
  return async (raw: z.input<S>): Promise<ActionResult> => {
    try {
      await requireStaff();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue.path.join(".");
        return { ok: false, error: field ? `${field}: ${issue.message}` : issue.message };
      }
      await run(parsed.data, { today: farmToday() });
    } catch (e) {
      return { ok: false, error: describe(e) };
    }
    refresh();
    return { ok: true };
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

export const markPaid = act(id, (invoiceId) =>
  prisma.invoice.updateMany({
    where: { id: invoiceId, status: "pending" },
    data: { status: "paid" },
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
    await tx.feedSale.create({
      data: {
        date: toDbDate(today),
        productId: q.productId,
        channel: "internal",
        buyer: q.division[0].toUpperCase() + q.division.slice(1),
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

export const createBuyerLogin = act(
  z.object({
    customerId: id,
    email: z.email().max(200),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
  }),
  async ({ customerId, email, password }) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new RuleError("That buyer no longer exists.");
    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) {
      throw new RuleError(`A login for ${email} already exists.`);
    }
    await createCredentialUser(prisma, {
      name: customer.name,
      email,
      password,
      role: "customer",
      customerId,
    });
  }
);

// ── Customers & sales ───────────────────────────────────────────────────────

export const addCustomer = act(
  z.object({ name: text, phone: optText, alloc: whole }),
  ({ name, phone, alloc }) =>
    prisma.customer.create({ data: { name, phone, weeklyCrates: alloc } })
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
    prisma.invoice.create({
      data: {
        date: toDbDate(today),
        customerId: v.cust,
        name: v.name,
        product: v.product,
        qty: v.qty,
        unit: v.unit || null,
        price: v.price,
        status: v.status,
      },
    })
);

// ── Layers ──────────────────────────────────────────────────────────────────

export const addProduction = act(
  z.object({ house: text, eggs: whole, cracked: whole }),
  ({ house, eggs, cracked }, { today }) =>
    prisma.eggProduction.create({
      data: { date: toDbDate(today), houseCode: house, eggs, cracked },
    })
);

export const addEggMove = act(
  z.object({ type: z.enum(["in", "out"]), crates: whole.positive() }),
  ({ type, crates }, { today }) =>
    prisma.eggMove.create({ data: { date: toDbDate(today), type, crates } })
);

export const logFeedUse = act(z.object({ house: text, kg: qty }), ({ house, kg }, { today }) =>
  prisma.feedUse.create({ data: { date: toDbDate(today), houseCode: house, kg } })
);

export const addBatch = act(
  z.object({
    batch: code,
    breed: text,
    supplier: text,
    received: z.iso.date(),
    birds: whole.positive(),
    mortality: whole,
    house: text,
    st: z.enum(["active", "closed"]),
  }),
  (b) =>
    prisma.batch.create({
      data: {
        code: b.batch,
        breed: b.breed,
        supplier: b.supplier,
        received: toDbDate(b.received),
        birds: b.birds,
        mortality: b.mortality,
        houseCode: b.house === "—" ? null : b.house,
        status: b.st,
      },
    })
);

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

export const addVaccination = act(
  z.object({
    item: id,
    batch: text,
    house: text,
    route: text,
    qtyUsed: level,
    status: z.enum(["done", "due", "overdue"]),
  }),
  (v, { today }) =>
    prisma.vaccination.create({
      data: {
        date: toDbDate(today),
        itemId: v.item,
        batchCode: v.batch,
        houseCode: v.house,
        route: v.route,
        qtyUsed: v.qtyUsed,
        status: v.status,
      },
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
  (m, { today }) =>
    prisma.medication.create({
      data: {
        date: toDbDate(today),
        itemId: m.item,
        reason: m.reason,
        batchCode: m.batch,
        dosage: m.dosage,
        qtyUsed: m.qtyUsed,
        status: m.status,
      },
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
  z.object({ sku: code, name: text, bag: qty, price: naira }),
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
    prisma.productionRun.create({
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
    prisma.feedSale.create({
      data: {
        date: toDbDate(today),
        productId: s.product,
        channel: s.channel,
        buyer: s.buyer,
        bags: s.bags,
        price: s.price,
      },
    })
);

export const addFeedRequest = act(
  z.object({ division: text, product: id, bags: whole.positive(), by: text }),
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
    .refine((m) => m.from !== m.to, "From and to must differ."),
  (m, { today }) =>
    prisma.invMove.create({
      data: {
        date: toDbDate(today),
        itemId: m.item,
        fromLoc: m.from,
        toLoc: m.to,
        qty: m.qty,
        by: m.by,
      },
    })
);
