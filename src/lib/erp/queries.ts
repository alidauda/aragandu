import "server-only";

import { prisma } from "@/lib/db";
import { farmToday, fromDbDate, weekStartOf } from "@/lib/dates";
import type { Division } from "@/lib/erp/divisions";
import type { ErpData } from "@/lib/erp/types";

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
  const today = farmToday();
  const desc = { date: "desc" } as const;
  const asc = { date: "asc" } as const;

  const [
    cratePrice,
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
    orders,
    feedUse,
    invMoves,
    layersFeedDeliveries,
    waterLogs,
    vaccinations,
    medications,
  ] = await Promise.all([
    getCratePrice(),
    prisma.user.findMany({
      where: { role: "staff" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.invite.findMany({
      where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      orderBy: { id: "asc" },
      include: { users: { select: { email: true } } },
    }),
    prisma.ingredient.findMany({ orderBy: { id: "asc" } }),
    prisma.feedProduct.findMany({ orderBy: { id: "asc" } }),
    prisma.batch.findMany({ orderBy: { received: "asc" } }),
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
    prisma.eggOrder.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.feedUse.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.invMove.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.layersFeedDelivery.findMany({ orderBy: [asc, { id: "asc" }] }),
    prisma.waterLog.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.vaccination.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.medication.findMany({ orderBy: [desc, { id: "desc" }] }),
  ]);

  return {
    today,
    weekStart: weekStartOf(today),
    viewer,
    cratePrice,
    staff: staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      since: farmToday(u.createdAt),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      name: i.name,
      role: i.role === "staff" ? "staff" : "customer",
      customerId: i.customerId,
      expires: farmToday(i.expiresAt),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      alloc: c.weeklyCrates,
      phone: c.phone,
      logins: c.users.map((u) => u.email),
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
    })),
    deliveries: deliveries.map((d) => ({
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
      date: fromDbDate(p.date),
      house: p.houseCode,
      eggs: p.eggs,
      cracked: p.cracked,
      rejects: p.rejects,
    })),
    eggMoves: eggMoves.map((m) => ({
      date: fromDbDate(m.date),
      type: m.type,
      crates: m.crates,
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
      unit: v.unit ?? undefined,
      orderId: v.orderId ?? undefined,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      date: fromDbDate(o.date),
      cust: o.customerId,
      crates: o.crates,
      status: o.status,
      notes: o.notes,
    })),
    feedUse: feedUse.map((u) => ({
      date: fromDbDate(u.date),
      house: u.houseCode,
      kg: u.kg,
    })),
    invMoves: invMoves.map((m) => ({
      date: fromDbDate(m.date),
      item: m.itemId,
      from: m.fromLoc,
      to: m.toLoc,
      qty: m.qty,
      by: m.by,
    })),
    layersFeedDeliveries: layersFeedDeliveries.map((d) => ({
      id: d.id,
      date: fromDbDate(d.date),
      supplier: d.supplier,
      kg: d.kg,
    })),
    waterLogs: waterLogs.map((w) => ({
      date: fromDbDate(w.date),
      house: w.houseCode,
      litres: w.litres,
    })),
    vaccinations: vaccinations.map((v) => ({
      date: fromDbDate(v.date),
      item: v.itemId,
      batch: v.batchCode,
      house: v.houseCode,
      route: v.route,
      qtyUsed: v.qtyUsed,
      status: v.status,
    })),
    medications: medications.map((m) => ({
      date: fromDbDate(m.date),
      item: m.itemId,
      reason: m.reason,
      batch: m.batchCode,
      dosage: m.dosage,
      qtyUsed: m.qtyUsed,
      status: m.status,
    })),
  };
}
