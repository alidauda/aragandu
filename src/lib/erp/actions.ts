"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { farmToday, toDbDate, weekStartOf } from "@/lib/dates";
import { addDays } from "@/lib/erp/derive";
import {
  assertNoBlockingDebt,
  EGG_PRODUCT,
  fulfilEggOrder,
  gradeCrates,
  markOrderPaidIfCovered,
  OPENING_STOCK,
  orderDue,
  placeEggOrder,
  RuleError,
  sellCratesToBuyer,
  takeCrates,
  ungradedEggs,
  type Tx,
} from "@/lib/egg-orders";
import { DIVISIONS, divisionBuyer } from "@/lib/erp/divisions";
import { takeBags, takeFinishedKg, takeIngredients } from "@/lib/feed-stock";
import { takeFromLocation } from "@/lib/inv-stock";
import {
  asGrants,
  canAct,
  canSee,
  DIVISION_SCOPES,
  FUNCTION_ROLES,
  grantsJson,
  hasAdminRole,
  roleLabels,
  locationsOf,
  mayGrant,
  noRoles,
  requestDivisionsOf,
  type Area,
  type Grants,
  type TeamLevel,
} from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { audit, brief } from "@/lib/audit";
import { addCredit, availableCredit, receiveAdvance, receivePayment } from "@/lib/money";
import { alertAdmins, notifyNewOrder } from "@/lib/notify";
import {
  later,
  mailCreditReceipt,
  mailInvite,
  mailInvoice,
  mailOrderDeclined,
  mailOrderFulfilled,
  mailOrderAwaitingPayment,
  mailOrderPaid,
  mailPaymentReceipt,
} from "@/lib/mail";
import { emailEnabled } from "@/lib/email";
import { naira as money } from "@/lib/orders";
import { createInvite, findOpenInvite } from "@/lib/invites";
import { AuthError, ForbiddenError, requireStaff } from "@/lib/session";

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

type Ctx = {
  /**
   * The farm day the write is for. For a `dated` record this is the day
   * chosen on the form (today unless backdated), so every date rule —
   * expiry, withdrawal, the allocation week, debt hold — follows it.
   */
  today: string;
  staffId: string;
  staffName: string;
  /** Admin in this action's part of the ERP. */
  isAdmin: boolean;
  /** The farm owner — the only one who can make, change or remove admins. */
  isOwner: boolean;
  /** All their roles (see src/lib/access.ts). */
  grants: Grants;
  /** Adds context to this write's audit entry (e.g. what a delete removed). */
  note: (summary: string, details?: unknown) => void;
};

/** A write whose result the client doesn't need. */
type Opts = {
  /** A day-to-day record that can be entered for an earlier day. */
  dated?: boolean;
};

/**
 * Each action's part of the ERP and the level it needs there (see
 * src/lib/access.ts). An action with no rule is refused. A null area means
 * the check depends on what's being changed and is made inside.
 */
const ACTION_RULE: Record<string, [Area | null, TeamLevel]> = {
  // Layers operations
  addProduction: ["layers", "staff"],
  addEggMove: ["layers", "staff"],
  reviewEggMove: ["layers", "admin"],
  logFeedUse: ["layers", "staff"],
  addBatch: ["layers", "staff"],
  recordMortality: ["layers", "staff"],
  setInLay: ["layers", "staff"],
  moveBatch: ["layers", "staff"],
  closeBatch: ["layers", "staff"],
  addHouse: ["layers", "staff"],
  updateHouse: ["layers", "admin"],
  addLayersFeedDelivery: ["layers", "staff"],
  addWaterLog: ["layers", "staff"],
  addVaccination: ["layers", "staff"],
  giveVaccination: ["layers", "staff"],
  addMedication: ["layers", "staff"],
  // Egg buyers, orders and sales
  fulfilOrder: ["eggsales", "staff"],
  declineOrder: ["eggsales", "staff"],
  addOrder: ["eggsales", "staff"],
  addInvoice: ["eggsales", "staff"],
  addCustomer: ["eggsales", "staff"],
  inviteBuyer: ["eggsales", "staff"],
  emailInvoice: ["eggsales", "staff"],
  setCratePrice: ["eggsales", "admin"],
  updateCustomer: ["eggsales", "admin"],
  removeCustomer: ["eggsales", "admin"],
  restoreCustomer: ["eggsales", "admin"],
  // Money
  markPaid: ["money", "admin"],
  recordPayment: ["money", "admin"],
  recordAdvance: ["money", "admin"],
  deletePayment: ["money", "admin"],
  markUnpaid: ["money", "admin"],
  markOrderPaid: ["money", "admin"],
  refundCredit: ["money", "admin"],
  // Feed mill
  addIngredient: ["feed", "staff"],
  addDelivery: ["feed", "staff"],
  addProduct: ["feed", "staff"],
  addRun: ["feed", "staff"],
  fulfilRequest: ["feed", "staff"],
  declineRequest: ["feed", "staff"],
  updateIngredient: ["feed", "admin"],
  updateProduct: ["feed", "admin"],
  addFeedSale: ["feedsales", "staff"],
  // Shared (finer checks inside)
  addFeedRequest: ["requests", "staff"],
  addInvItem: ["inventory", "staff"],
  addInvMove: ["inventory", "staff"],
  updateInvItem: ["inventory", "admin"],
  inviteStaff: ["team", "admin"],
  setUserGrants: ["team", "admin"],
  revokeInvite: [null, "staff"],
  setUserDisabled: [null, "staff"],
  emailInvite: [null, "staff"],
  deleteEntry: [null, "admin"],
};

/**
 * A division's people move stock only between the central store and their
 * own location (or use it from there) — never another division's.
 */
function assertOwnLocations(grants: Grants, from: string | null, to: string | null) {
  const mine = locationsOf(grants);
  if (mine === null) return;
  const ok = (loc: string | null) => loc === null || loc === "store" || mine.includes(loc);
  if (!ok(from) || !ok(to) || !(mine.includes(from ?? "") || mine.includes(to ?? ""))) {
    throw new ForbiddenError(`You can only move stock in and out of your own store (${mine.join(", ") || "none"}).`);
  }
}

/** The area each deletable entry belongs to. */
const ENTRY_AREA: Record<string, Area> = {
  production: "layers",
  eggMove: "layers",
  feedUse: "layers",
  water: "layers",
  layersFeedDelivery: "layers",
  vaccination: "layers",
  medication: "layers",
  delivery: "feed",
  run: "feed",
  feedSale: "feed",
  invMove: "inventory",
  invoice: "eggsales",
};

/** How far back staff can record; admins can go further. */
const BACKDATE_DAYS = 7;

/** The day a dated record is for: today unless a past date was picked. */
function recordDay(raw: unknown, today: string, isAdmin: boolean) {
  const date = (raw as { date?: unknown } | null)?.date;
  if (date === undefined || date === "" || date === today) return today;
  if (typeof date !== "string" || !z.iso.date().safeParse(date).success) {
    throw new RuleError("Pick a valid date.");
  }
  if (date > today) throw new RuleError("You can't record for a future date.");
  if (!isAdmin && date < addDays(today, -BACKDATE_DAYS)) {
    throw new RuleError(`Staff can record up to ${BACKDATE_DAYS} days back — ask an admin for anything older.`);
  }
  return date;
}

function act<S extends z.ZodType>(
  name: string,
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<unknown>,
  opts: Opts = {}
) {
  const inner = actReturning(
    name,
    schema,
    async (input, ctx) => {
      await run(input, ctx);
      return undefined;
    },
    opts
  );
  return async (raw: z.input<S>): Promise<ActionResult> => inner(raw);
}

/** A record that may be for an earlier day: `date` (optional) is that day. */
function dated<S extends z.ZodType>(
  name: string,
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<unknown>,
  opts: Omit<Opts, "dated"> = {}
) {
  const inner = act(name, schema, run, { ...opts, dated: true });
  return async (raw: z.input<S> & { date?: string }): Promise<ActionResult> => inner(raw);
}

/** A write that hands a value back to the client (e.g. an invite link). */
function actReturning<S extends z.ZodType, R>(
  name: string,
  schema: S,
  run: (input: z.output<S>, ctx: Ctx) => Promise<R>,
  opts: Opts = {}
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
      let noted: { summary: string; details?: unknown } | null = null;
      // Their roles decide: the action's area and the level it needs there.
      const grants = await grantsOf(session.user.id);
      const rule = ACTION_RULE[name];
      if (!rule) throw new ForbiddenError("That isn't allowed.");
      const [area, need] = rule;
      if (area && !canAct(grants, area, need)) {
        throw new ForbiddenError(
          canSee(grants, area) ? "Only an admin can do that." : "That isn't part of your work."
        );
      }
      const isAdmin = area ? canAct(grants, area, "admin") : hasAdminRole(grants);
      const isOwner = grants.owner;
      const today = farmToday();
      const day = opts.dated ? recordDay(raw, today, isAdmin) : today;
      data = await run(parsed.data, {
        today: day,
        staffId: session.user.id,
        staffName: session.user.name,
        isAdmin,
        isOwner,
        grants,
        note: (summary, details) => {
          noted = { summary, details };
        },
      });
      const n = noted as { summary: string; details?: unknown } | null;
      await audit({
        userId: session.user.id,
        actor: session.user.name,
        action: name,
        summary: `${n?.summary ?? brief(parsed.data)}${day !== today ? ` · for ${day}` : ""}`,
        details: n?.details ?? parsed.data,
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

/** Fulfil all of an order, or `crates` of it (the rest stays pending). */
export const fulfilOrder = act(
  "fulfilOrder",
  z.object({ orderId: id, crates: whole.positive().optional() }),
  ({ orderId, crates }, { staffName, note }) =>
    fulfilEggOrder(orderId, crates, staffName).then((r) => {
      note(
        `order #${orderId}${crates ? ` · ${crates} crates` : ""}${r.remainder ? ` · ${r.remainder} left pending` : ""}`
      );
      later(() => mailOrderFulfilled(orderId, r.remainder));
    })
);

export const declineOrder = act("declineOrder", id, async (orderId) => {
  const r = await prisma.eggOrder.updateMany({
    where: { id: orderId, status: "pending" },
    data: { status: "declined" },
  });
  if (r.count === 0) throw new RuleError("This order has already been handled.");
  later(() => mailOrderDeclined(orderId));
});

const method = z.enum(["transfer", "cash", "pos"]);

/** Shortcut: the whole outstanding balance, by transfer. */
export const markPaid = act(
  "markPaid",
  id,
  (invoiceId, { today, staffName }) =>
    prisma
      .$transaction((tx) =>
        receivePayment(tx, invoiceId, "balance", { method: "transfer", reference: "", today, by: staffName })
      )
      .then((r) => later(() => mailPaymentReceipt({ invoiceId, amount: r.applied, method: "transfer" }))),
);

/** Money in against an invoice. More than the balance becomes the buyer's credit. */
export const recordPayment = dated(
  "recordPayment",
  z.object({
    invoiceId: id,
    amount: z.number().positive("Enter an amount above 0.").finite().transform(Math.round),
    method,
    reference: optText,
  }),
  ({ invoiceId, amount, method, reference }, { today, staffName, note }) =>
    prisma
      .$transaction((tx) => receivePayment(tx, invoiceId, amount, { method, reference, today, by: staffName }))
      .then((r) => {
        note(
          `INV-${String(invoiceId).padStart(5, "0")} · ${amount} by ${method}${reference ? ` (${reference})` : ""}${
            r.credit ? ` · ${r.credit} kept as credit` : ""
          }`
        );
        // Only once it's committed: never a receipt for money that wasn't saved.
        later(() => mailPaymentReceipt({ invoiceId, amount: r.applied, method, credit: r.credit }));
      }),
);

/** A buyer paying before there's an invoice: it's held as their credit. */
export const recordAdvance = dated(
  "recordAdvance",
  z.object({
    customerId: id,
    amount: z.number().positive("Enter an amount above 0.").finite().transform(Math.round),
    method,
    reference: optText,
  }),
  ({ customerId, amount, method, reference }, { today, staffName }) =>
    prisma
      .$transaction((tx) => receiveAdvance(tx, customerId, amount, { method, reference, today, by: staffName }))
      .then(() => later(() => mailCreditReceipt({ customerId, amount, method }))),
);

/** Removes one payment; the invoice is owed again if it no longer covers it. */
export const deletePayment = act(
  "deletePayment",
  id,
  (paymentId, { note }) =>
    prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) throw new RuleError("That payment no longer exists.");
      note(`payment #${p.id} · ${p.amount} (${p.method}) on invoice #${p.invoiceId}`, { removed: p });
      // A credit draw's ledger line goes with it (cascade), returning the credit.
      await tx.payment.delete({ where: { id: paymentId } });
      const inv = await tx.invoice.findUniqueOrThrow({
        where: { id: p.invoiceId },
        select: { qty: true, price: true, payments: { select: { amount: true } } },
      });
      const paid = inv.payments.reduce((x, y) => x + y.amount, 0);
      if (paid < inv.qty * inv.price) {
        await tx.invoice.update({ where: { id: p.invoiceId }, data: { status: "pending", paidAt: null } });
      }
    }).then(() => alertAdmins("A payment was removed", "An admin deleted a payment — see Activity.")),
);

/** Undo every payment on an invoice (credit draws go back to the buyer's credit). */
export const markUnpaid = act(
  "markUnpaid",
  id,
  (invoiceId, { note }) =>
    prisma.$transaction(async (tx) => {
      const removed = await tx.payment.findMany({ where: { invoiceId } });
      note(`INV-${String(invoiceId).padStart(5, "0")} · ${removed.length} payments removed`, { removed });
      await tx.payment.deleteMany({ where: { invoiceId } });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "pending", paidAt: null } });
    }).then(() => alertAdmins("Payments were undone", "An admin removed all payments on an invoice — see Activity.")),
);

export const fulfilRequest = act("fulfilRequest", id, (reqId, { today }) =>
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

export const setCratePrice = act("setCratePrice", 
  z.number().positive().finite().transform(Math.round),
  async (cratePrice, { note }) => {
    const before = await prisma.settings.findUnique({ where: { id: 1 } });
    await prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, cratePrice },
      update: { cratePrice },
    });
    note(`crate price ${before?.cratePrice ?? "unset"} → ${cratePrice}`);
  },
);

export const declineRequest = act("declineRequest", id, async (reqId) => {
  const r = await prisma.feedRequest.updateMany({
    where: { id: reqId, status: "pending" },
    data: { status: "declined" },
  });
  if (r.count === 0) throw new RuleError("This request has already been handled.");
});

// ── People & invites ────────────────────────────────────────────────────────

const email = z.email("Enter a valid email.").max(200);

/** The roles form: a farm level, a level per division, cross-division roles. */
const grantsInput = z.object({
  farm: z.enum(["admin", "staff"]).nullable().default(null),
  divisions: z
    .object(Object.fromEntries(DIVISION_SCOPES.map((d) => [d, z.enum(["admin", "staff"]).optional()])))
    .default({}),
  functions: z.array(z.enum(FUNCTION_ROLES)).default([]),
});
const toGrants = (g: z.output<typeof grantsInput>): Grants => asGrants(g);
/** A team member as someone else may change them: never the owner, never yourself. */
async function teamTarget(userId: string, me: Ctx) {
  if (userId === me.staffId) throw new RuleError("You can't change your own access.");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, owner: true } });
  if (!u) throw new RuleError("That login no longer exists.");
  if (u.owner) throw new RuleError("The farm owner's account can't be changed here.");
  return { role: u.role, grants: u.role === "customer" ? null : await grantsOf(userId) };
}

/** Invites a team member with their roles. Returns the link path. */
export const inviteStaff = actReturning("inviteStaff", 
  z.object({ name: text, email, roles: grantsInput }),
  ({ name, email, roles }, { staffId, grants }) => {
    const g = toGrants(roles);
    if (noRoles(g)) throw new RuleError("Give them at least one role.");
    if (!mayGrant(grants, g)) {
      throw new RuleError(
        hasAdminRole(g) ? "Only the owner can give admin roles." : "You can only give staff roles in the divisions you run."
      );
    }
    return createInvite({
      name,
      email,
      role: hasAdminRole(g) ? "admin" : "staff",
      access: grantsJson(g),
      createdById: staffId,
    });
  },
);

export const inviteBuyer = actReturning("inviteBuyer", 
  z.object({ customerId: id, email }),
  async ({ customerId, email }, { staffId }) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.archivedAt) throw new RuleError("That buyer no longer exists.");
    return createInvite({
      name: customer.name,
      email,
      role: "customer",
      customerId,
      createdById: staffId,
    });
  }
);

/** Who may handle an invite: buyer invites — egg sales; team invites — whoever could give those roles. */
async function assertInviteMine(invite: { role: string; access: unknown }, me: Ctx) {
  const ok =
    invite.role === "customer" ? canAct(me.grants, "eggsales") : mayGrant(me.grants, asGrants(invite.access));
  if (!ok) throw new ForbiddenError("That invite isn't yours to handle.");
}

export const revokeInvite = act("revokeInvite", 
  id,
  async (inviteId, ctx) => {
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new RuleError("That invite no longer exists.");
    await assertInviteMine(invite, ctx);
    await prisma.invite.updateMany({
      where: { id: inviteId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
);

/**
 * Sets a team member's roles — several at once (Layers admin + Feed mill
 * staff + Sales…). You can only change someone whose current roles you
 * could give, and only to roles you could give.
 */
export const setUserGrants = act(
  "setUserGrants",
  z.object({ userId: text, roles: grantsInput }),
  async ({ userId, roles }, ctx) => {
    const target = await teamTarget(userId, ctx);
    if (!target.grants) throw new RuleError("That person isn't on the team.");
    const g = toGrants(roles);
    if (noRoles(g)) throw new RuleError("Give them at least one role — or remove their access instead.");
    if (!mayGrant(ctx.grants, target.grants) || !mayGrant(ctx.grants, g)) {
      throw new RuleError("Only the owner can give or change admin roles; division admins manage their own staff.");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { access: grantsJson(g), role: hasAdminRole(g) ? "admin" : "staff", division: null },
    });
    ctx.note(`roles → ${roleLabels(g).join(", ")}`, { before: grantsJson(target.grants), after: grantsJson(g) });
  },
);

/**
 * Remove (or restore) someone's access — staff or buyer. Disabling ends
 * their sessions at once; their records stay.
 */
export const setUserDisabled = act("setUserDisabled", 
  z.object({ userId: text, disabled: z.boolean() }),
  async ({ userId, disabled }, ctx) => {
    const target = await teamTarget(userId, ctx);
    const ok = target.grants ? mayGrant(ctx.grants, target.grants) : canAct(ctx.grants, "eggsales", "admin");
    if (!ok) {
      throw new ForbiddenError(
        target.grants ? "Only the owner can remove an admin's access." : "Only an admin can remove a buyer's access."
      );
    }
    await prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id: userId }, data: { disabled } });
      if (r.count === 0) throw new RuleError("That login no longer exists.");
      if (disabled) await tx.session.deleteMany({ where: { userId } });
    });
  },
);

// ── Customers & sales ───────────────────────────────────────────────────────

/**
 * New buyer. With an email, their portal invite is created in the same step
 * and its link returned. Only an admin sets the weekly allocation: a buyer
 * added by staff starts at 0 crates until an admin sets it.
 */
export const addCustomer = actReturning(
  "addCustomer",
  z.object({
    name: text,
    phone: optText,
    alloc: whole,
    email: z.union([z.email("Enter a valid email, or leave it blank."), z.literal("")]),
  }),
  async ({ name, phone, alloc, email }, { staffId, isAdmin }) => {
    // Check first, so a taken email doesn't leave a buyer created half-way.
    if (email && (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))) {
      throw new RuleError(`${email.toLowerCase()} already has a login.`);
    }
    const customer = await prisma.customer.create({
      data: { name, phone, weeklyCrates: isAdmin ? alloc : 0 },
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

/**
 * Removes a buyer. With no history at all (no orders, invoices, payments,
 * credit or checkouts) they're deleted outright, logins and invites too.
 * Otherwise they're archived: hidden from lists, logins off, can't order —
 * but every invoice, payment and order stays for the books. A buyer the
 * farm still owes paid orders to can't be removed until those are settled.
 */
export const removeCustomer = actReturning("removeCustomer", id, async (customerId, { note }) =>
  prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({
      where: { id: customerId },
      include: {
        users: { select: { id: true } },
        _count: { select: { invoices: true, orders: true, credits: true, charges: true } },
      },
    });
    if (!c || c.archivedAt) throw new RuleError("That buyer has already been removed.");
    const history = c._count.invoices + c._count.orders + c._count.credits + c._count.charges;
    if (history === 0) {
      await tx.invite.deleteMany({ where: { customerId } });
      await tx.user.deleteMany({ where: { customerId } });
      await tx.customer.delete({ where: { id: customerId } });
      note(`${c.name} deleted (no history)`);
      return { deleted: true };
    }
    const paidWaiting = await tx.eggOrder.count({ where: { customerId, status: "pending", paidAt: { not: null } } });
    if (paidWaiting) {
      throw new RuleError(
        `${c.name} has ${paidWaiting} paid order${paidWaiting > 1 ? "s" : ""} waiting — fulfil or decline ${paidWaiting > 1 ? "them" : "it"} first.`
      );
    }
    await tx.eggOrder.updateMany({
      where: { customerId, status: "pending" },
      data: { status: "declined", declineReason: "Buyer removed" },
    });
    await tx.user.updateMany({ where: { customerId }, data: { disabled: true } });
    await tx.session.deleteMany({ where: { userId: { in: c.users.map((u) => u.id) } } });
    await tx.invite.updateMany({ where: { customerId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.customer.update({ where: { id: customerId }, data: { archivedAt: new Date() } });
    const owed = await tx.invoice.findMany({
      where: { customerId, status: "pending" },
      select: { qty: true, price: true, payments: { select: { amount: true } } },
    });
    const due = owed.reduce((a, v) => a + v.qty * v.price - v.payments.reduce((x, p) => x + p.amount, 0), 0);
    note(`${c.name} archived (has history)${due > 0 ? ` · still owes ${money.format(due)}` : ""}`);
    return { deleted: false };
  })
);

/** Brings an archived buyer back. Their portal logins stay off until an admin restores access. */
export const restoreCustomer = act("restoreCustomer", id, async (customerId, { note }) => {
  const r = await prisma.customer.updateMany({
    where: { id: customerId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  if (r.count === 0) throw new RuleError("That buyer isn't archived.");
  note(`buyer #${customerId} restored`);
});

/**
 * Staff ordering on a buyer's behalf — same rules as the portal. It's
 * unpaid until the buyer pays (they're emailed a link) or an admin
 * records their transfer with Mark paid; credit that covers it pays it.
 */
export const addOrder = act(
  "addOrder",
  z.object({ cust: id, crates: whole.positive() }),
  ({ cust, crates }, { note }) =>
    placeEggOrder(cust, crates).then(({ order, paid, due }) => {
      note(`order #${order.id} · ${crates} crates${paid ? " · paid from credit" : ` · ${due} to pay`}`);
      if (paid) {
        later(() => mailOrderPaid(order.id));
        later(() => notifyNewOrder(order.id));
      } else {
        later(() => mailOrderAwaitingPayment(order.id, due));
      }
    })
);

/**
 * Admin: the buyer paid for an order another way (transfer, cash, POS).
 * The money becomes their credit, held for the order, which can then be
 * fulfilled. It must cover what's left to pay.
 */
export const markOrderPaid = dated(
  "markOrderPaid",
  z.object({ orderId: id, method, reference: optText }),
  async ({ orderId, method, reference }, { today, staffName, note }) => {
    const r = await prisma.$transaction(async (tx) => {
      const order = await tx.eggOrder.findUnique({ where: { id: orderId } });
      if (!order || order.status !== "pending") throw new RuleError("This order has already been handled.");
      if (order.paidAt) throw new RuleError("This order is already paid for.");
      const due = await orderDue(tx, order);
      if (due > 0) {
        await addCredit(tx, order.customerId, due, {
          today,
          by: staffName,
          note: `Paid for order #${orderId} by ${method}${reference ? ` (${reference})` : ""}`,
          kind: "order",
          method,
          orderId,
        });
      }
      if (!(await markOrderPaidIfCovered(tx, orderId))) throw new RuleError("Couldn't mark it paid — try again.");
      return { due };
    });
    note(`order #${orderId} · ${r.due} by ${method}${reference ? ` (${reference})` : ""}`);
    later(() => mailOrderPaid(orderId, r.due));
  },
);

/**
 * Admin: money given back to a buyer from their credit (e.g. after a paid
 * order couldn't be filled). Only free credit — not what's holding a paid
 * order — can be refunded. The transfer itself is made outside the app.
 */
export const refundCredit = dated(
  "refundCredit",
  z.object({
    customerId: id,
    amount: z.number().positive("Enter an amount above 0.").finite().transform(Math.round),
    method,
    reference: optText,
  }),
  async ({ customerId, amount, method, reference }, { today, staffName, note }) => {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`;
      const free = await availableCredit(tx, customerId);
      if (amount > free) {
        throw new RuleError(
          free > 0 ? `Only ${money.format(free)} of their credit is free to refund.` : "They have no free credit to refund."
        );
      }
      await addCredit(tx, customerId, -amount, {
        today,
        by: staffName,
        note: `Refunded by ${method}${reference ? ` (${reference})` : ""}`,
        kind: "refund",
        method,
      });
    });
    note(`${money.format(amount)} refunded by ${method}`);
    void alertAdmins("Credit refunded", `${staffName} refunded ${money.format(amount)} of a buyer's credit by ${method}.`);
  },
);

/**
 * A sale at the counter.
 * - Crates to a registered buyer go through the order gate (allocation,
 *   debt hold, stock) at the crate price.
 * - Spent hens come out of a named batch.
 * - Walk-ins pay cash: the invoice waits as "cash to confirm" until an
 *   admin records the money. Only an admin can record payment at the sale,
 *   or set a price other than the crate price.
 */
export const addInvoice = dated(
  "addInvoice",
  z
    .object({
      cust: id.nullable(),
      walkIn: optText,
      product: z.enum([EGG_PRODUCT, "Spent hens"]),
      qty: whole.positive(),
      /** Crates: an admin override of the crate price. Hens: the price per bird. */
      price: naira.optional(),
      batch: optText.optional(),
      paid: z.object({ method, reference: optText }).optional(),
    })
    .refine((v) => v.cust !== null || v.walkIn, "Enter the walk-in buyer's name."),
  ({ cust, walkIn, product, qty, price, batch, paid }, { today, staffName, isAdmin, grants, note }) =>
    prisma.$transaction(async (tx) => {
      if (paid && !canAct(grants, "money", "admin")) throw new RuleError("Only an admin can record a payment.");
      const eggs = product === EGG_PRODUCT;
      if (eggs && price !== undefined && !isAdmin) {
        throw new RuleError("Crates sell at the crate price; only an admin can set another price.");
      }
      let invoiceId: number;
      if (eggs && cust !== null) {
        invoiceId = (await sellCratesToBuyer(tx, { customerId: cust, crates: qty, price, today, by: staffName })).id;
      } else {
        const customer = cust !== null ? await tx.customer.findUnique({ where: { id: cust } }) : null;
        if (cust !== null && !customer) throw new RuleError("That buyer no longer exists.");
        if (customer?.archivedAt) throw new RuleError(`${customer.name} has been removed — restore them on Customers first.`);
        if (customer) await assertNoBlockingDebt(tx, customer.id, weekStartOf(today));
        let unitPrice = price;
        if (eggs) {
          await takeCrates(tx, qty);
          unitPrice = price ?? (await tx.settings.findUnique({ where: { id: 1 } }))?.cratePrice;
          if (!unitPrice) throw new RuleError("Set the crate price first.");
        } else if (!unitPrice) {
          throw new RuleError("Enter the price per bird.");
        }
        const inv = await tx.invoice.create({
          data: {
            date: toDbDate(today),
            customerId: customer?.id ?? null,
            name: customer?.name ?? `${walkIn} (walk-in)`,
            product,
            qty,
            unit: eggs ? null : "birds",
            price: unitPrice,
          },
        });
        invoiceId = inv.id;
        if (!eggs) {
          if (!batch) throw new RuleError("Choose the batch the hens came from.");
          await takeBirds(tx, { batch, birds: qty, reason: "sold", invoiceId, today, by: staffName });
        }
      }
      if (paid) {
        await receivePayment(tx, invoiceId, "balance", { ...paid, today, by: staffName });
      }
      note(`INV-${String(invoiceId).padStart(5, "0")} · ${qty} ${eggs ? "crates" : "hens"}${paid ? " · paid" : ""}`);
      return invoiceId;
    }).then((invoiceId) => {
      // A registered buyer gets the invoice by email; walk-ins have none.
      if (cust !== null) later(() => mailInvoice(invoiceId));
    })
);

// ── Layers ──────────────────────────────────────────────────────────────────

/** Whether a house's eggs that day can't be sold: a drug given by then is still in withdrawal. */
async function inWithdrawal(tx: Tx, house: string, today: string) {
  const day = toDbDate(today);
  const running = { houseCode: house, date: { lte: day }, withdrawalUntil: { gte: day } };
  const [v, m] = await Promise.all([
    tx.vaccination.findFirst({ where: { ...running, status: "done" } }),
    tx.medication.findFirst({ where: running }),
  ]);
  return Boolean(v || m);
}

/**
 * A house's collection. During a withdrawal period its good eggs are
 * recorded as withheld, so they can't be graded and sold.
 */
export const addProduction = dated(
  "addProduction",
  z
    .object({ house: text, eggs: whole.positive(), cracked: whole, rejects: whole.default(0) })
    .refine((p) => p.cracked + p.rejects <= p.eggs, "Cracked + rejects can't exceed eggs collected."),
  ({ house, eggs, cracked, rejects }, { today, note }) =>
    prisma.$transaction(async (tx) => {
      const withheld = (await inWithdrawal(tx, house, today)) ? eggs - cracked - rejects : 0;
      await tx.eggProduction.create({
        data: { date: toDbDate(today), houseCode: house, eggs, cracked, rejects, withheld },
      });
      note(`${house} · ${eggs} eggs${withheld ? ` · ${withheld} withheld (withdrawal)` : ""}`);
    })
);

/** Write-offs above this share of stock (and this many crates) need an admin. */
const WRITE_OFF_SHARE = 0.05;
const WRITE_OFF_MIN = 5;

/**
 * Crates into or out of the store.
 * - In: can't pack more crates than the ungraded eggs allow. "Opening
 *   stock" (admin only) records crates already on the shelf at go-live.
 * - Out: needs a reason. A large write-off by staff waits for an admin.
 */
export const addEggMove = dated(
  "addEggMove",
  z.object({
    type: z.enum(["in", "out"]),
    crates: whole.positive(),
    reason: optText.default(""),
  }),
  ({ type, crates, reason }, { today, staffName, isAdmin, note }) =>
    prisma.$transaction(async (tx) => {
      const base = { date: toDbDate(today), type, crates, requestedBy: staffName };
      if (type === "in") {
        if (reason === OPENING_STOCK) {
          if (!isAdmin) throw new RuleError("Only an admin can record opening stock.");
        } else {
          await gradeCrates(tx, crates);
        }
        await tx.eggMove.create({ data: { ...base, reason } });
        return;
      }
      if (!reason) throw new RuleError("Give a reason for crates leaving without a sale.");
      const stock = await takeCrates(tx, crates);
      const large = crates > Math.max(WRITE_OFF_MIN, Math.floor(stock * WRITE_OFF_SHARE));
      const status = large && !isAdmin ? "pending" : "approved";
      await tx.eggMove.create({
        data: { ...base, reason, status, reviewedBy: status === "approved" && isAdmin ? staffName : null },
      });
      note(`${crates} crates out · ${reason}${status === "pending" ? " · awaiting admin approval" : ""}`);
      if (status === "pending") {
        void alertAdmins(
          "A write-off needs approval",
          `${staffName} recorded ${crates} crates out (${reason}). Approve or reject it on Egg inventory.`
        );
      }
    })
);

/** Admin: approve (stock goes down) or reject a pending write-off. */
export const reviewEggMove = act(
  "reviewEggMove",
  z.object({ id, approve: z.boolean() }),
  ({ id: moveId, approve }, { staffName, note }) =>
    prisma.$transaction(async (tx) => {
      const m = await tx.eggMove.findUnique({ where: { id: moveId } });
      if (!m || m.status !== "pending") throw new RuleError("That write-off has already been reviewed.");
      if (approve) await takeCrates(tx, m.crates);
      await tx.eggMove.update({
        where: { id: moveId },
        data: { status: approve ? "approved" : "rejected", reviewedBy: staffName },
      });
      note(`${approve ? "approved" : "rejected"} ${m.crates} crates out (${m.reason}) by ${m.requestedBy}`);
    }),
);

// Shared by every write that draws on Layers' feed.
const LAYERS_FEED_LOCK = 4245;

/** Layers' feed on hand: external deliveries + mill transfers − use. */
async function layersFeedStock(tx: Tx) {
  const [external, used, transfers] = await Promise.all([
    tx.layersFeedDelivery.aggregate({ _sum: { kg: true } }),
    tx.feedUse.aggregate({ _sum: { kg: true } }),
    tx.feedSale.findMany({
      where: { channel: "internal", buyer: { equals: "Layers", mode: "insensitive" } },
      select: { bags: true, product: { select: { bagKg: true } } },
    }),
  ]);
  const fromMill = transfers.reduce((a, t) => a + t.bags * t.product.bagKg, 0);
  return (external._sum.kg ?? 0) + fromMill - (used._sum.kg ?? 0);
}

/** Feed used can't exceed the feed Layers has. */
export const logFeedUse = dated(
  "logFeedUse",
  z.object({ house: text, kg: qty }),
  ({ house, kg }, { today }) =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LAYERS_FEED_LOCK})::text`;
      const stock = await layersFeedStock(tx);
      if (kg > stock + 1e-9) {
        throw new RuleError(
          stock <= 0
            ? "Layers has no feed recorded. Record a delivery, or ask the mill for feed."
            : `Only ${stock.toLocaleString("en-US", { maximumFractionDigits: 1 })} kg of feed on hand.`
        );
      }
      await tx.feedUse.create({ data: { date: toDbDate(today), houseCode: house, kg } });
    })
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

async function assertRoom(tx: Tx, house: string, birds: number) {
  const room = await houseRoom(tx, house);
  if (birds > room) {
    throw new RuleError(
      room <= 0 ? `${house} is full.` : `${house} only has room for ${room.toLocaleString("en-US")} more birds.`
    );
  }
}

/** Birds leaving a batch (died, culled or sold), never more than are left. */
async function takeBirds(
  tx: Tx,
  o: {
    batch: string;
    birds: number;
    reason: "died" | "culled" | "sold";
    invoiceId?: number;
    today: string;
    by: string;
  }
) {
  const rows = await tx.$queryRaw<{ birds: number; mortality: number; status: string; received: Date }[]>`
    SELECT birds, mortality, status::text AS status, received FROM batches WHERE code = ${o.batch} FOR UPDATE`;
  const b = rows[0];
  if (!b) throw new RuleError("That batch no longer exists.");
  if (b.status !== "active") throw new RuleError(`${o.batch} is closed.`);
  if (toDbDate(o.today) < b.received) throw new RuleError(`${o.batch} hadn't arrived by then.`);
  const alive = b.birds - b.mortality;
  if (o.birds > alive) throw new RuleError(`Only ${alive.toLocaleString("en-US")} birds left in ${o.batch}.`);
  await tx.batch.update({ where: { code: o.batch }, data: { mortality: { increment: o.birds } } });
  await tx.birdOut.create({
    data: {
      date: toDbDate(o.today),
      batchCode: o.batch,
      reason: o.reason,
      birds: o.birds,
      invoiceId: o.invoiceId ?? null,
      by: o.by,
    },
  });
}

const isoDate = z.iso.date();

export const addBatch = act(
  "addBatch",
  z
    .object({
      batch: code,
      breed: text,
      supplier: text,
      /** When the flock arrived — can be in the past. */
      received: isoDate,
      /** When it started (or starts) laying; empty = not yet. */
      inLay: isoDate.optional(),
      birds: whole.positive(),
      mortality: whole,
      /** "—" places the batch without a house. */
      house: text,
      st: z.enum(["active", "closed"]),
    })
    .refine((b) => !b.inLay || b.inLay >= b.received, "Laying can't start before the flock arrived."),
  (b, { today }) =>
    prisma.$transaction(async (tx) => {
      if (b.received > today) throw new RuleError("The arrival date can't be in the future.");
      const houseCode = b.house === "—" ? null : b.house;
      if (houseCode) await assertRoom(tx, houseCode, b.birds);
      await tx.batch.create({
        data: {
          code: b.batch,
          breed: b.breed,
          supplier: b.supplier,
          received: toDbDate(b.received),
          inLay: b.inLay ? toDbDate(b.inLay) : null,
          birds: b.birds,
          mortality: b.mortality,
          houseCode,
          status: b.st,
        },
      });
    })
);

/** Deaths and culls (sales go through Record sale). */
export const recordMortality = dated(
  "recordMortality",
  z.object({ batch: text, birds: whole.positive(), reason: z.enum(["died", "culled"]).default("died") }),
  ({ batch, birds, reason }, { today, staffName }) =>
    prisma.$transaction((tx) => takeBirds(tx, { batch, birds, reason, today, by: staffName }))
);

/** The flock starts laying (from this date it counts toward the lay rate). */
export const setInLay = act(
  "setInLay",
  z.object({ batch: text, date: isoDate }),
  async ({ batch, date }, { today }) => {
    if (date > today) throw new RuleError("Pick today or an earlier date.");
    const b = await prisma.batch.findUnique({ where: { code: batch } });
    if (!b) throw new RuleError("That batch no longer exists.");
    if (toDbDate(date) < b.received) throw new RuleError("Laying can't start before the flock arrived.");
    await prisma.batch.update({ where: { code: batch }, data: { inLay: toDbDate(date) } });
  }
);

/** Moves a whole batch to another house (or out of one). */
export const moveBatch = act(
  "moveBatch",
  z.object({ batch: text, house: text }),
  ({ batch, house }, { note }) =>
    prisma.$transaction(async (tx) => {
      const b = await tx.batch.findUnique({ where: { code: batch } });
      if (!b || b.status !== "active") throw new RuleError("Only an active batch can be moved.");
      const to = house === "—" ? null : house;
      if (to === b.houseCode) throw new RuleError("It's already there.");
      if (to) await assertRoom(tx, to, b.birds - b.mortality);
      await tx.batch.update({ where: { code: batch }, data: { houseCode: to } });
      note(`${batch} · ${b.houseCode ?? "no house"} → ${to ?? "no house"}`);
    })
);

/** Depopulated: the batch leaves its house and stops counting as in lay. */
export const closeBatch = act("closeBatch", text, async (batch) => {
  const r = await prisma.batch.updateMany({
    where: { code: batch, status: "active" },
    data: { status: "closed", houseCode: null },
  });
  if (r.count === 0) throw new RuleError("That batch is already closed.");
});

export const addHouse = act("addHouse", z.object({ code, capacity: whole.positive() }), (h) =>
  prisma.house.create({ data: h })
);

export const addLayersFeedDelivery = dated(
  "addLayersFeedDelivery",
  z.object({ supplier: text, kg: qty, pricePerKg: rate }),
  ({ supplier, kg, pricePerKg }, { today }) =>
    prisma.layersFeedDelivery.create({ data: { date: toDbDate(today), supplier, kg, pricePerKg } })
);

export const addWaterLog = dated(
  "addWaterLog",
  z.object({ house: text, litres: qty }),
  ({ house, litres }, { today }) =>
    prisma.waterLog.create({ data: { date: toDbDate(today), houseCode: house, litres } })
);

/** The item, refusing it if its stock has expired. */
async function usableItem(tx: Tx, itemId: number, today: string) {
  const item = await tx.invItem.findUnique({ where: { id: itemId } });
  if (!item) throw new RuleError("That item no longer exists.");
  if (item.expiresOn && item.expiresOn < toDbDate(today)) {
    throw new RuleError(`${item.name} expired on ${item.expiresOn.toISOString().slice(0, 10)} — don't use it.`);
  }
  return item;
}

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

/** The day after which eggs can be sold again, or null if the item has no withdrawal. */
const withdrawalEnd = (today: string, days: number) =>
  days > 0 ? toDbDate(addDays(today, days)) : null;

export const addVaccination = dated(
  "addVaccination",
  z.object({
    item: id,
    batch: text,
    house: text,
    route: text,
    qtyUsed: level,
    status: z.enum(["done", "due", "overdue"]),
    /** For a scheduled dose: when it's due. */
    dueDate: isoDate.optional(),
  }),
  (v, { today, staffName }) =>
    prisma.$transaction(async (tx) => {
      const given = v.status === "done";
      const item = given ? await usableItem(tx, v.item, today) : null;
      if (!given && v.dueDate && v.dueDate < today) throw new RuleError("A due date can't be in the past.");
      const rec = await tx.vaccination.create({
        data: {
          date: toDbDate(given ? today : (v.dueDate ?? today)),
          itemId: v.item,
          batchCode: v.batch,
          houseCode: v.house,
          route: v.route,
          qtyUsed: given ? v.qtyUsed : 0,
          status: given ? "done" : "due",
          withdrawalUntil: item ? withdrawalEnd(today, item.withdrawalDays) : null,
        },
      });
      if (given) await drawAtLayers(tx, v.item, v.qtyUsed, today, staffName, { vaccinationId: rec.id });
    })
);

/** A scheduled dose is given: it's dated today and draws its stock. */
export const giveVaccination = dated(
  "giveVaccination",
  z.object({ id, qtyUsed: qty }),
  ({ id: vaxId, qtyUsed }, { today, staffName }) =>
    prisma.$transaction(async (tx) => {
      const v = await tx.vaccination.findUnique({ where: { id: vaxId } });
      if (!v || v.status === "done") throw new RuleError("That dose has already been recorded.");
      const item = await usableItem(tx, v.itemId, today);
      await tx.vaccination.update({
        where: { id: vaxId },
        data: {
          status: "done",
          date: toDbDate(today),
          qtyUsed,
          withdrawalUntil: withdrawalEnd(today, item.withdrawalDays),
        },
      });
      await drawAtLayers(tx, v.itemId, qtyUsed, today, staffName, { vaccinationId: vaxId });
    })
);

export const addMedication = dated(
  "addMedication",
  z.object({
    item: id,
    reason: text,
    batch: text,
    dosage: text,
    qtyUsed: level,
    status: z.enum(["ongoing", "completed"]),
  }),
  (m, { today, staffName, note }) =>
    prisma.$transaction(async (tx) => {
      const item = await usableItem(tx, m.item, today);
      const batch = await tx.batch.findUnique({ where: { code: m.batch } });
      if (!batch) throw new RuleError("That batch no longer exists.");
      const until = withdrawalEnd(today, item.withdrawalDays);
      const rec = await tx.medication.create({
        data: {
          date: toDbDate(today),
          itemId: m.item,
          reason: m.reason,
          batchCode: m.batch,
          houseCode: batch.houseCode,
          dosage: m.dosage,
          qtyUsed: m.qtyUsed,
          status: m.status,
          withdrawalUntil: until,
        },
      });
      await drawAtLayers(tx, m.item, m.qtyUsed, today, staffName, { medicationId: rec.id });
      if (until && batch.houseCode) {
        note(`${item.name} · ${m.batch} · eggs from ${batch.houseCode} withheld until ${until.toISOString().slice(0, 10)}`);
      }
    })
);

// ── Feed mill ───────────────────────────────────────────────────────────────

export const addIngredient = act("addIngredient", 
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

export const addDelivery = dated("addDelivery", 
  z.object({ ing: id, kg: qty, price: rate }),
  ({ ing, kg, price }, { today }) =>
    prisma.ingredientDelivery.create({
      data: { date: toDbDate(today), ingredientId: ing, kg, pricePerKg: price },
    })
);

export const addProduct = act("addProduct", 
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

export const addRun = dated("addRun", 
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

export const addFeedSale = dated("addFeedSale", 
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

export const addFeedRequest = act("addFeedRequest", 
  z.object({ division: z.enum(DIVISIONS), product: id, bags: whole.positive() }),
  (q, { today, grants, staffName }) => {
    // A division asks for its own feed; the mill (and the whole farm) can log any.
    const mine = requestDivisionsOf(grants);
    if (mine !== null && !mine.includes(q.division)) {
      throw new ForbiddenError("You can only request feed for your own division.");
    }
    return prisma.feedRequest.create({
      data: {
        date: toDbDate(today),
        division: q.division,
        productId: q.product,
        bags: q.bags,
        // Whoever is signed in made the request.
        requestedBy: staffName,
      },
    });
  }
);

// ── Central inventory ───────────────────────────────────────────────────────

export const addInvItem = act(
  "addInvItem",
  z.object({
    sku: code,
    name: text,
    cat: z.enum(["medication", "equipment", "packaging", "supplies"]),
    unit: text,
    reorder: level,
    cost: naira,
    /** Medication: days after a dose before eggs can be sold. */
    withdrawalDays: whole.default(0),
    /** Expiry of the stock on hand (optional). */
    expiresOn: z.union([isoDate, z.literal("")]).optional(),
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
        withdrawalDays: i.withdrawalDays,
        expiresOn: i.expiresOn ? toDbDate(i.expiresOn) : null,
      },
    })
);

export const addInvMove = dated("addInvMove", 
  z
    .object({
      item: id,
      from: text.nullable(),
      to: text.nullable(),
      qty,
    })
    .refine((m) => m.from !== m.to, "From and to must differ.")
    .refine((m) => m.from !== null || m.to !== null, "A receipt goes into a location, not straight to used."),
  (m, { today, grants, staffName }) =>
    prisma.$transaction(async (tx) => {
      assertOwnLocations(grants, m.from, m.to);
      if (m.from !== null) await takeFromLocation(tx, m.item, m.from, m.qty);
      await tx.invMove.create({
        data: {
          date: toDbDate(today),
          itemId: m.item,
          fromLoc: m.from,
          toLoc: m.to,
          qty: m.qty,
          // Whoever is signed in recorded the move.
          by: staffName,
        },
      });
    })
);

// ── Corrections (admin) ─────────────────────────────────────────────────────
// Catalogs are edited in place. Ledger entries are deleted and re-entered,
// and a delete is refused if it would leave any stock below zero.

/** Notes an edit's old and new values for the Activity log. */
function noteChange(note: Ctx["note"], what: string, before: object, after: object) {
  const changed = Object.keys(after).filter(
    (k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k])
  );
  const fmt = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  note(
    `${what}: ${changed.map((k) => `${k} ${fmt((before as Record<string, unknown>)[k])} → ${fmt((after as Record<string, unknown>)[k])}`).join(", ") || "no change"}`,
    { before, after }
  );
}

export const updateCustomer = act(
  "updateCustomer",
  z.object({ id, name: text, phone: optText, alloc: whole }),
  async ({ id, name, phone, alloc }, { note }) => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { id } });
    const after = { name, phone, weeklyCrates: alloc };
    await prisma.customer.update({ where: { id }, data: after });
    noteChange(note, before.name, before, after);
  },
);

export const updateIngredient = act(
  "updateIngredient",
  z.object({
    id,
    name: text,
    cat: z.enum(["energy", "protein", "fibre", "mineral", "additive"]),
    reorder: level,
  }),
  async ({ id, name, cat, reorder }, { note }) => {
    const before = await prisma.ingredient.findUniqueOrThrow({ where: { id } });
    const after = { name, category: cat, reorderKg: reorder };
    await prisma.ingredient.update({ where: { id }, data: after });
    noteChange(note, before.name, before, after);
  },
);

/** Bag size and SKU stay fixed: stock is counted in them. */
export const updateProduct = act(
  "updateProduct",
  z.object({
    id,
    name: text,
    price: z.number().positive("Enter a price above 0.").finite().transform(Math.round),
  }),
  async ({ id, name, price }, { note }) => {
    const before = await prisma.feedProduct.findUniqueOrThrow({ where: { id } });
    const after = { name, price };
    await prisma.feedProduct.update({ where: { id }, data: after });
    noteChange(note, before.name, before, after);
  },
);

export const updateHouse = act(
  "updateHouse",
  z.object({ code: text, capacity: whole.positive() }),
  ({ code, capacity }, { note }) =>
    prisma.$transaction(async (tx) => {
      const room = await houseRoom(tx, code);
      const before = await tx.house.findUniqueOrThrow({ where: { code } });
      const birds = before.capacity - room;
      if (capacity < birds) {
        throw new RuleError(`${code} holds ${birds.toLocaleString("en-US")} birds now.`);
      }
      await tx.house.update({ where: { code }, data: { capacity } });
      noteChange(note, code, before, { capacity });
    }),
);

export const updateInvItem = act(
  "updateInvItem",
  z.object({
    id,
    name: text,
    cat: z.enum(["medication", "equipment", "packaging", "supplies"]),
    unit: text,
    reorder: level,
    cost: naira,
    /** Medication: days after a dose before eggs can be sold. */
    withdrawalDays: whole.default(0),
    /** Expiry of the stock on hand (optional). */
    expiresOn: z.union([isoDate, z.literal("")]).optional(),
  }),
  async ({ id, name, cat, unit, reorder, cost, withdrawalDays, expiresOn }, { note }) => {
    const before = await prisma.invItem.findUniqueOrThrow({ where: { id } });
    const after = {
      name,
      category: cat,
      unit,
      reorder,
      cost,
      withdrawalDays,
      expiresOn: expiresOn ? toDbDate(expiresOn) : null,
    };
    await prisma.invItem.update({ where: { id }, data: after });
    noteChange(note, before.name, before, after);
  },
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

/** The row a delete is about to remove, for the audit log. */
async function snapshot(tx: Tx, kind: EntryKind, id: number): Promise<object | null> {
  const where = { where: { id } };
  switch (kind) {
    case "production": return tx.eggProduction.findUnique(where);
    case "eggMove": return tx.eggMove.findUnique(where);
    case "feedUse": return tx.feedUse.findUnique(where);
    case "water": return tx.waterLog.findUnique(where);
    case "layersFeedDelivery": return tx.layersFeedDelivery.findUnique(where);
    case "vaccination": return tx.vaccination.findUnique(where);
    case "medication": return tx.medication.findUnique(where);
    case "delivery": return tx.ingredientDelivery.findUnique(where);
    case "run": return tx.productionRun.findUnique({ where: { id }, include: { lines: true } });
    case "feedSale": return tx.feedSale.findUnique(where);
    case "invMove": return tx.invMove.findUnique(where);
    case "invoice": return tx.invoice.findUnique({ where: { id }, include: { payments: true } });
  }
}

export const deleteEntry = act("deleteEntry", 
  z.object({ kind: z.enum(ENTRY_KINDS), id }),
  ({ kind, id }, { note, grants }) =>
    prisma.$transaction(async (tx) => {
      // Corrections are for admins of the entry's part of the farm.
      if (!canAct(grants, ENTRY_AREA[kind], "admin")) {
        throw new ForbiddenError("Only an admin of that part of the farm can delete it.");
      }
      const gone = () => new RuleError("That entry no longer exists.");
      const removed = await snapshot(tx, kind, id);
      if (!removed) throw gone();
      if (kind === "invMove") {
        const m = removed as { fromLoc: string | null; toLoc: string | null };
        assertOwnLocations(grants, m.fromLoc, m.toLoc);
      }
      note(`${kind} #${id} — ${brief(removed)}`, { kind, id, removed });
      switch (kind) {
        case "production": {
          const p = removed as { eggs: number; cracked: number; rejects: number; withheld: number };
          const good = p.eggs - p.cracked - p.rejects - p.withheld;
          const { ungraded } = await ungradedEggs(tx);
          if (good > ungraded) {
            throw new RuleError(
              "Crates have already been graded from these eggs — remove those crates first."
            );
          }
          await tx.eggProduction.delete({ where: { id } });
          return;
        }
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
          if (m.type === "in" && m.status === "approved") {
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
          const paid = await tx.payment.count({ where: { invoiceId: id } });
          if (paid > 0) throw new RuleError("It has payments recorded — remove them first.");
          // Hens sold on it go back into their batch.
          for (const o of await tx.birdOut.findMany({ where: { invoiceId: id } })) {
            await tx.batch.update({ where: { code: o.batchCode }, data: { mortality: { decrement: o.birds } } });
            await tx.birdOut.delete({ where: { id: o.id } });
          }
          void alertAdmins("An invoice was deleted", "An admin deleted an unpaid invoice — see Activity.");
          await tx.invoice.delete({ where: { id } });
          // An order's invoice going away puts the order back to pending.
          if (v.orderId) {
            await tx.eggOrder.update({ where: { id: v.orderId }, data: { status: "pending" } });
          }
          return;
        }
      }
    }),
);

// ── Email ───────────────────────────────────────────────────────────────────

/** Sends the buyer their invoice, with a link to it in their portal. */
export const emailInvoice = act("emailInvoice", id, async (invoiceId, { note }) => {
  if (!emailEnabled()) throw new RuleError("Email isn't set up yet.");
  const sent = await mailInvoice(invoiceId);
  if (!sent.ok) throw new RuleError(sent.error);
  note(`INV-${String(invoiceId).padStart(5, "0")} emailed`);
});

/**
 * Emails an invite link (again) to the address it was made for. The link
 * must be a live invite — the token is checked, not trusted.
 */
export const emailInvite = act("emailInvite", z.object({ path: z.string().max(200) }), async ({ path }, ctx) => {
  const { note } = ctx;
  if (!emailEnabled()) throw new RuleError("Email isn't set up yet.");
  const token = path.match(/^\/invite\/([A-Za-z0-9_-]{20,100})$/)?.[1];
  const invite = token ? await findOpenInvite(token) : null;
  if (!invite) throw new RuleError("That invite link has expired or was replaced.");
  await assertInviteMine({ role: invite.role, access: invite.access }, ctx);
  const sent = await mailInvite({
    email: invite.email,
    role: invite.role,
    buyer: invite.customer?.name ?? invite.name,
    path,
  });
  if (!sent.ok) throw new RuleError(sent.error);
  note(`invite emailed to ${invite.email}`);
});
