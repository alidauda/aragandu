import "server-only";

import { prisma } from "@/lib/db";
import { releaseUnpaid } from "@/lib/egg-orders";
import { farmToday, fromDbDate, weekStartOf } from "@/lib/dates";
import type { Division } from "@/lib/erp/divisions";
import { emailEnabled } from "@/lib/email";
import { asRole } from "@/lib/roles";
import { asGrants, canSee, isFarmWide, locationsOf, requestDivisionsOf, type Grants } from "@/lib/access";
import { divisionBuyer } from "@/lib/erp/divisions";
import type { ErpData } from "@/lib/erp/types";

export async function getSettings() {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  return { cratePrice: s?.cratePrice ?? 0, eggsPerCrate: s?.eggsPerCrate ?? 30 };
}

export async function getCratePrice(): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  return s?.cratePrice ?? 0;
}

/**
 * Every ledger and catalog the ERP screens read, mapped to the client
 * shapes. The farm's volumes are small enough to load whole; when a ledger
 * outgrows that, give it a date window here and nowhere else.
 */
export async function loadErpData(viewer: ErpData["viewer"]): Promise<ErpData> {
  // Unpaid orders past their hold are released before anyone reads them.
  await releaseUnpaid(prisma);
  const today = farmToday();
  const desc = { date: "desc" } as const;
  const asc = { date: "asc" } as const;

  const [
    settings,
    staff,
    invites,
    customers,
    ingredients,
    products,
    batches,
    houses,
    invItems,
    deliveries,
    runs,
    feedSales,
    reqs,
    prodLog,
    eggMoves,
    invoices,
    payments,
    orders,
    feedUse,
    invMoves,
    layersFeedDeliveries,
    waterLogs,
    birdOuts,
    vaccinations,
    medications,
  ] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { role: { in: ["admin", "staff"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, owner: true, division: true, access: true, disabled: true, createdAt: true },
    }),
    prisma.invite.findMany({
      where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      orderBy: { id: "asc" },
      include: {
        users: { select: { id: true, email: true, disabled: true } },
        credits: { select: { amount: true } },
      },
    }),
    prisma.ingredient.findMany({ orderBy: { id: "asc" } }),
    prisma.feedProduct.findMany({ orderBy: { id: "asc" } }),
    prisma.batch.findMany({
      orderBy: { received: "asc" },
      include: { birdsOut: { select: { reason: true, birds: true } } },
    }),
    prisma.house.findMany({ orderBy: { code: "asc" } }),
    prisma.invItem.findMany({ orderBy: { id: "asc" } }),
    prisma.ingredientDelivery.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.productionRun.findMany({
      orderBy: [asc, { id: "asc" }],
      include: { lines: { orderBy: { id: "asc" } } },
    }),
    prisma.feedSale.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.feedRequest.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.eggProduction.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.eggMove.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.invoice.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.payment.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.eggOrder.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.feedUse.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.invMove.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.layersFeedDelivery.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.waterLog.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.birdOut.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.vaccination.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.medication.findMany({ orderBy: [desc, { id: "desc" }] }),
  ]);

  const paidBy = new Map<number, number>();
  for (const p of payments) paidBy.set(p.invoiceId, (paidBy.get(p.invoiceId) ?? 0) + p.amount);

  return scopeData(viewer.grants, {
    today,
    weekStart: weekStartOf(today),
    viewer,
    cratePrice: settings.cratePrice,
    eggsPerCrate: settings.eggsPerCrate,
    emailEnabled: emailEnabled(),
    staff: staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "admin" ? "admin" : "staff",
      owner: u.owner,
      grants: u.access
        ? asGrants(u.access, u.owner)
        : asGrants(u.division ? { divisions: { [u.division]: u.role } } : { farm: u.role }, u.owner),
      disabled: u.disabled,
      since: farmToday(u.createdAt),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      name: i.name,
      role: asRole(i.role),
      customerId: i.customerId,
      grants: i.role === "customer" ? null : asGrants(i.access ?? (i.division ? { divisions: { [i.division]: i.role } } : { farm: i.role })),
      expires: farmToday(i.expiresAt),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      alloc: c.weeklyCrates,
      phone: c.phone,
      logins: c.users.map((u) => ({ userId: u.id, email: u.email, disabled: u.disabled })),
      credit: c.credits.reduce((a, x) => a + x.amount, 0),
      archived: c.archivedAt !== null,
    })),
    ingredients: ingredients.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      cat: i.category,
      reorder: i.reorderKg,
    })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      bag: p.bagKg,
      price: p.price,
    })),
    batches: batches.map((b) => ({
      batch: b.code,
      breed: b.breed,
      supplier: b.supplier,
      received: fromDbDate(b.received),
      birds: b.birds,
      mortality: b.mortality,
      out: {
        died: b.birdsOut.filter((o) => o.reason === "died").reduce((a, o) => a + o.birds, 0),
        culled: b.birdsOut.filter((o) => o.reason === "culled").reduce((a, o) => a + o.birds, 0),
        sold: b.birdsOut.filter((o) => o.reason === "sold").reduce((a, o) => a + o.birds, 0),
      },
      inLay: b.inLay ? fromDbDate(b.inLay) : undefined,
      house: b.houseCode ?? "—",
      st: b.status,
    })),
    houses: houses.map((h) => ({ code: h.code, capacity: h.capacity })),
    invItems: invItems.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      cat: i.category,
      unit: i.unit,
      reorder: i.reorder,
      cost: i.cost,
      withdrawalDays: i.withdrawalDays,
      expiresOn: i.expiresOn ? fromDbDate(i.expiresOn) : undefined,
    })),
    deliveries: deliveries.map((d) => ({
      id: d.id,
      ing: d.ingredientId,
      date: fromDbDate(d.date),
      kg: d.kg,
      price: d.pricePerKg,
    })),
    runs: runs.map((r) => ({
      id: r.id,
      run: r.code,
      date: fromDbDate(r.date),
      product: r.productId,
      operator: r.operator,
      output: r.outputKg,
      lines: r.lines.map((l) => [l.ingredientId, l.kg, l.pricePerKg]),
    })),
    feedSales: feedSales.map((s) => ({
      id: s.id,
      date: fromDbDate(s.date),
      product: s.productId,
      channel: s.channel,
      buyer: s.buyer,
      bags: s.bags,
      price: s.price,
      reqId: s.requestId ?? undefined,
    })),
    reqs: reqs.map((q) => ({
      id: q.id,
      date: fromDbDate(q.date),
      division: q.division as Division,
      product: q.productId,
      bags: q.bags,
      by: q.requestedBy,
      status: q.status,
    })),
    prodLog: prodLog.map((p) => ({
      id: p.id,
      date: fromDbDate(p.date),
      house: p.houseCode,
      eggs: p.eggs,
      cracked: p.cracked,
      rejects: p.rejects,
      withheld: p.withheld,
    })),
    eggMoves: eggMoves.map((m) => ({
      id: m.id,
      date: fromDbDate(m.date),
      type: m.type,
      crates: m.crates,
      reason: m.reason,
      status: m.status,
      requestedBy: m.requestedBy,
      reviewedBy: m.reviewedBy ?? undefined,
    })),
    invoices: invoices.map((v) => ({
      id: v.id,
      date: fromDbDate(v.date),
      cust: v.customerId,
      name: v.name,
      product: v.product,
      qty: v.qty,
      price: v.price,
      status: v.status,
      paidAt: v.paidAt ? fromDbDate(v.paidAt) : undefined,
      paid: paidBy.get(v.id) ?? 0,
      unit: v.unit ?? undefined,
      orderId: v.orderId ?? undefined,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      date: fromDbDate(p.date),
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      by: p.by,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      date: fromDbDate(o.date),
      cust: o.customerId,
      crates: o.crates,
      status: o.status,
      notes: o.notes,
      price: o.price ?? undefined,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : undefined,
      paidAt: o.paidAt ? o.paidAt.toISOString() : undefined,
      payBy: o.payBy ? o.payBy.toISOString() : undefined,
      declineReason: o.declineReason ?? undefined,
    })),
    feedUse: feedUse.map((u) => ({
      id: u.id,
      date: fromDbDate(u.date),
      house: u.houseCode,
      kg: u.kg,
    })),
    invMoves: invMoves.map((m) => ({
      id: m.id,
      date: fromDbDate(m.date),
      item: m.itemId,
      from: m.fromLoc,
      to: m.toLoc,
      qty: m.qty,
      by: m.by,
      health: m.vaccinationId !== null || m.medicationId !== null,
    })),
    layersFeedDeliveries: layersFeedDeliveries.map((d) => ({
      id: d.id,
      date: fromDbDate(d.date),
      supplier: d.supplier,
      kg: d.kg,
      pricePerKg: d.pricePerKg,
    })),
    waterLogs: waterLogs.map((w) => ({
      id: w.id,
      date: fromDbDate(w.date),
      house: w.houseCode,
      litres: w.litres,
    })),
    birdOuts: birdOuts.map((o) => ({
      id: o.id,
      date: fromDbDate(o.date),
      batch: o.batchCode,
      reason: o.reason,
      birds: o.birds,
      invoiceId: o.invoiceId ?? undefined,
      by: o.by,
    })),
    vaccinations: vaccinations.map((v) => ({
      id: v.id,
      date: fromDbDate(v.date),
      item: v.itemId,
      batch: v.batchCode,
      house: v.houseCode,
      route: v.route,
      qtyUsed: v.qtyUsed,
      status: v.status,
      withdrawalUntil: v.withdrawalUntil ? fromDbDate(v.withdrawalUntil) : undefined,
    })),
    medications: medications.map((m) => ({
      id: m.id,
      date: fromDbDate(m.date),
      item: m.itemId,
      reason: m.reason,
      batch: m.batchCode,
      dosage: m.dosage,
      qtyUsed: m.qtyUsed,
      status: m.status,
      house: m.houseCode ?? undefined,
      withdrawalUntil: m.withdrawalUntil ? fromDbDate(m.withdrawalUntil) : undefined,
    })),
  });
}

/**
 * What someone may see, by their roles — the rest never leaves the server.
 * The owner and farm-wide members see everything.
 */
function scopeData(g: Grants, d: ErpData): ErpData {
  if (isFarmWide(g)) return d;
  const keep = <T,>(ok: boolean, rows: T[]) => (ok ? rows : []);
  const buyers = canSee(g, "eggsales") || canSee(g, "money");
  const layers = canSee(g, "layers");
  const mill = canSee(g, "feed");
  const feedSales = mill || canSee(g, "feedsales");
  const locations = locationsOf(g);
  const asks = requestDivisionsOf(g);
  const myDivisions = Object.keys(g.divisions);
  const sharesDivision = (m: Grants | null) => !!m && Object.keys(m.divisions).some((x) => myDivisions.includes(x));
  return {
    ...d,
    // Egg buyers, their orders, invoices and money.
    customers: keep(buyers, d.customers),
    invoices: keep(buyers, d.invoices),
    payments: keep(buyers, d.payments),
    orders: keep(buyers, d.orders),
    // Layers operations.
    prodLog: keep(layers, d.prodLog),
    eggMoves: keep(layers, d.eggMoves),
    batches: keep(layers, d.batches),
    houses: keep(layers, d.houses),
    layersFeedDeliveries: keep(layers, d.layersFeedDeliveries),
    feedUse: keep(layers, d.feedUse),
    waterLogs: keep(layers, d.waterLogs),
    vaccinations: keep(layers, d.vaccinations),
    medications: keep(layers, d.medications),
    birdOuts: keep(layers, d.birdOuts),
    // The mill's own books.
    ingredients: keep(mill, d.ingredients),
    deliveries: keep(mill, d.deliveries),
    runs: keep(mill, d.runs),
    // Feed sold: all of it for the mill and sales; a division's own feed otherwise.
    feedSales: feedSales
      ? d.feedSales
      : d.feedSales.filter(
          (s) => s.channel === "internal" && myDivisions.includes(s.buyer.trim().toLowerCase())
        ),
    reqs: asks === null ? d.reqs : d.reqs.filter((q) => asks.includes(q.division)),
    // Stock moves in and out of their own locations.
    invMoves: locations === null ? d.invMoves : d.invMoves.filter((m) => locations.includes(m.from ?? "") || locations.includes(m.to ?? "")),
    // People who share a division with them (and themselves); invites they could act on.
    staff: d.staff.filter((m) => m.id === d.viewer.id || sharesDivision(m.grants)),
    invites: d.invites.filter((i) => (i.grants ? sharesDivision(i.grants) : canSee(g, "eggsales"))),
  };
}
