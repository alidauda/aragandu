import "server-only";

import { prisma } from "@/lib/db";
import { releaseUnpaid } from "@/lib/egg-orders";
import { farmToday, fromDbDate, weekStartOf } from "@/lib/dates";
import type { Division } from "@/lib/erp/divisions";
import { emailEnabled } from "@/lib/email";
import { paystackEnabled } from "@/lib/paystack";
import { PROOF_FIELDS } from "@/lib/proofs";
import { ASSET_CONDITIONS, byTag, type AssetCondition } from "@/lib/erp/assets";
import { asRole } from "@/lib/roles";
import { asGrants, canSee, isFarmWide, locationsOf, requestDivisionsOf, type Grants } from "@/lib/access";
import { divisionBuyer } from "@/lib/erp/divisions";
import type { ErpData } from "@/lib/erp/types";
import { BROILER_PRODUCTS, birdUnit, feedUnit, PULLET_PRODUCT, RUMINANT_PRODUCTS } from "./broilers";

export async function getSettings() {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  return {
    cratePrice: s?.cratePrice ?? 0,
    eggsPerCrate: s?.eggsPerCrate ?? 30,
    feedBagKg: s?.feedBagKg || 25,
    paymentMode: s?.paymentMode === "manual" ? ("manual" as const) : ("online" as const),
    paymentNote: s?.paymentNote ?? "",
    bankName: s?.bankName ?? "",
    accountName: s?.accountName ?? "",
    accountNumber: s?.accountNumber ?? "",
  };
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
    proofs,
    assets,
    orderMoney,
    manure,
    financeEntries,
    financeMonths,
    broilerHouses,
    broilerBatches,
    broilerDaily,
    broilerWeighings,
    broilerSales,
    broilerFeedDeliveries,
    broilerHealth,
    broilerProcessing,
    processedSales,
    broilerExpenses,
    broodingDispatches,
    animals,
    animalWeights,
    animalHealth,
    ruminantFeed,
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
      include: {
        birdsOut: { select: { reason: true, birds: true } },
        placements: { orderBy: { houseCode: "asc" } },
      },
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
    prisma.paymentProof.findMany({ orderBy: { id: "desc" }, take: 500, select: PROOF_FIELDS }),
    locationsOf(viewer.grants) === null && canSee(viewer.grants, "inventory")
      ? prisma.asset.findMany({ include: { events: { orderBy: { id: "desc" }, take: 30 } } })
      : Promise.resolve([]),
    prisma.customerCredit.groupBy({
      by: ["orderId"],
      where: { kind: "order", orderId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.manureEntry.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.financeEntry.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.financeMonth.findMany(),
    prisma.broilerHouse.findMany({ orderBy: { code: "asc" } }),
    prisma.broilerBatch.findMany({ orderBy: { received: "asc" } }),
    prisma.broilerDaily.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerWeighing.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerSale.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerFeedDelivery.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerHealth.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerProcessing.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.processedSale.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broilerExpense.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.broodingDispatch.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.animal.findMany({ orderBy: { tag: "asc" } }),
    prisma.animalWeight.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.animalHealth.findMany({ orderBy: [desc, { id: "desc" }] }),
    prisma.ruminantFeed.findMany({ orderBy: [desc, { id: "desc" }] }),
  ]);

  const paidTowards = new Map(orderMoney.map((m) => [m.orderId, m._sum.amount ?? 0]));
  const paidBy = new Map<number, number>();
  for (const p of payments) paidBy.set(p.invoiceId, (paidBy.get(p.invoiceId) ?? 0) + p.amount);

  return scopeData(viewer.grants, {
    today,
    weekStart: weekStartOf(today),
    viewer,
    cratePrice: settings.cratePrice,
    eggsPerCrate: settings.eggsPerCrate,
    feedBagKg: settings.feedBagKg,
    paymentMode: settings.paymentMode,
    paymentNote: settings.paymentNote,
    bankName: settings.bankName,
    accountName: settings.accountName,
    accountNumber: settings.accountNumber,
    paystackReady: paystackEnabled(),
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
      createdAt: i.createdAt?.toISOString(),
      email: i.email,
      name: i.name,
      role: asRole(i.role),
      customerId: i.customerId,
      grants: i.role === "customer" ? null : asGrants(i.access ?? (i.division ? { divisions: { [i.division]: i.role } } : { farm: i.role })),
      expires: farmToday(i.expiresAt),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      createdAt: c.createdAt?.toISOString(),
      name: c.name,
      alloc: c.weeklyCrates,
      phone: c.phone,
      logins: c.users.map((u) => ({ userId: u.id, email: u.email, disabled: u.disabled })),
      credit: c.credits.reduce((a, x) => a + x.amount, 0),
      archived: c.archivedAt !== null,
      price: c.cratePrice ?? undefined,
    })),
    ingredients: ingredients.map((i) => ({
      id: i.id,
      createdAt: i.createdAt?.toISOString(),
      code: i.code,
      name: i.name,
      cat: i.category,
      reorder: i.reorderKg,
    })),
    products: products.map((p) => ({
      id: p.id,
      createdAt: p.createdAt?.toISOString(),
      sku: p.sku,
      name: p.name,
      bag: p.bagKg,
      price: p.price,
    })),
    batches: batches.map((b) => ({
      batch: b.code,
      createdAt: b.createdAt?.toISOString(),
      breed: b.breed,
      supplier: b.supplier,
      received: fromDbDate(b.received),
      ageOnArrival: b.ageOnArrival,
      birds: b.birds,
      mortality: b.mortality,
      out: {
        died: b.birdsOut.filter((o) => o.reason === "died").reduce((a, o) => a + o.birds, 0),
        culled: b.birdsOut.filter((o) => o.reason === "culled").reduce((a, o) => a + o.birds, 0),
        sold: b.birdsOut.filter((o) => o.reason === "sold").reduce((a, o) => a + o.birds, 0),
      },
      inLay: b.inLay ? fromDbDate(b.inLay) : undefined,
      house: b.placements.map((p) => p.houseCode).join(", ") || "—",
      placements: b.placements.map((p) => ({ house: p.houseCode, birds: p.birds })),
      st: b.status,
    })),
    houses: houses.map((h) => ({ code: h.code, capacity: h.capacity, createdAt: h.createdAt?.toISOString() })),
    invItems: invItems.map((i) => ({
      id: i.id,
      createdAt: i.createdAt?.toISOString(),
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
      createdAt: d.createdAt?.toISOString(),
      ing: d.ingredientId,
      date: fromDbDate(d.date),
      kg: d.kg,
      price: d.pricePerKg,
    })),
    runs: runs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt?.toISOString(),
      run: r.code,
      date: fromDbDate(r.date),
      product: r.productId,
      operator: r.operator,
      output: r.outputKg,
      lines: r.lines.map((l) => [l.ingredientId, l.kg, l.pricePerKg]),
    })),
    feedSales: feedSales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt?.toISOString(),
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
      createdAt: q.createdAt?.toISOString(),
      date: fromDbDate(q.date),
      division: q.division as Division,
      product: q.productId,
      bags: q.bags,
      by: q.requestedBy,
      status: q.status,
    })),
    prodLog: prodLog.map((p) => ({
      id: p.id,
      createdAt: p.createdAt?.toISOString(),
      date: fromDbDate(p.date),
      house: p.houseCode,
      batch: p.batchCode ?? undefined,
      eggs: p.eggs,
      cracked: p.cracked,
      rejects: p.rejects,
      withheld: p.withheld,
    })),
    eggMoves: eggMoves.map((m) => ({
      id: m.id,
      createdAt: m.createdAt?.toISOString(),
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
      createdAt: v.createdAt?.toISOString(),
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
      createdAt: p.createdAt?.toISOString(),
      invoiceId: p.invoiceId,
      date: fromDbDate(p.date),
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      by: p.by,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt?.toISOString(),
      date: fromDbDate(o.date),
      cust: o.customerId,
      crates: o.crates,
      status: o.status,
      notes: o.notes,
      price: o.price ?? undefined,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : undefined,
      paidAt: o.paidAt ? o.paidAt.toISOString() : undefined,
      paidSoFar: paidTowards.get(o.id) ?? 0,
      payBy: o.payBy ? o.payBy.toISOString() : undefined,
      declineReason: o.declineReason ?? undefined,
    })),
    feedUse: feedUse.map((u) => ({
      id: u.id,
      createdAt: u.createdAt?.toISOString(),
      date: fromDbDate(u.date),
      house: u.houseCode,
      batch: u.batchCode ?? undefined,
      kg: u.kg,
      product: u.productId ?? undefined,
    })),
    invMoves: invMoves.map((m) => ({
      id: m.id,
      createdAt: m.createdAt?.toISOString(),
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
      createdAt: d.createdAt?.toISOString(),
      date: fromDbDate(d.date),
      supplier: d.supplier,
      kg: d.kg,
      pricePerKg: d.pricePerKg,
      product: d.productId ?? undefined,
    })),
    waterLogs: waterLogs.map((w) => ({
      id: w.id,
      createdAt: w.createdAt?.toISOString(),
      date: fromDbDate(w.date),
      house: w.houseCode,
      batch: w.batchCode ?? undefined,
      litres: w.litres,
    })),
    birdOuts: birdOuts.map((o) => ({
      id: o.id,
      createdAt: o.createdAt?.toISOString(),
      date: fromDbDate(o.date),
      batch: o.batchCode,
      house: o.houseCode ?? undefined,
      reason: o.reason,
      birds: o.birds,
      invoiceId: o.invoiceId ?? undefined,
      by: o.by,
    })),
    vaccinations: vaccinations.map((v) => ({
      id: v.id,
      createdAt: v.createdAt?.toISOString(),
      date: fromDbDate(v.date),
      item: v.itemId,
      batch: v.batchCode,
      house: v.houseCode,
      route: v.route,
      qtyUsed: v.qtyUsed,
      status: v.status,
      withdrawalUntil: v.withdrawalUntil ? fromDbDate(v.withdrawalUntil) : undefined,
    })),
    assets: assets
      .map((a) => ({
        id: a.id,
        tag: a.tag,
        name: a.name,
        location: a.location,
        condition: (ASSET_CONDITIONS as readonly string[]).includes(a.condition) ? (a.condition as AssetCondition) : "good",
        assignedTo: a.assignedTo,
        notes: a.notes,
        disposedAt: a.disposedAt?.toISOString(),
        disposedNote: a.disposedNote ?? undefined,
        createdAt: a.createdAt.toISOString(),
        history: a.events.map((e) => ({ at: e.at.toISOString(), by: e.by, kind: e.kind, summary: e.summary })),
      }))
      .sort(byTag),
    proofs: proofs.map((p) => ({
      id: p.id,
      cust: p.customerId ?? undefined,
      orderId: p.orderId ?? undefined,
      invoiceId: p.invoiceId ?? undefined,
      amount: p.amount,
      reference: p.reference,
      note: p.note,
      fileName: p.fileName,
      mimeType: p.mimeType,
      status: p.status === "accepted" || p.status === "rejected" ? p.status : "submitted",
      rejectReason: p.rejectReason ?? undefined,
      reviewedBy: p.reviewedBy ?? undefined,
      by: p.uploadedBy,
      createdAt: p.createdAt.toISOString(),
    })),
    medications: medications.map((m) => ({
      id: m.id,
      createdAt: m.createdAt?.toISOString(),
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
    manure: manure.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      date: fromDbDate(m.date),
      kind: m.kind === "sold" ? ("sold" as const) : ("produced" as const),
      batch: m.batchCode ?? undefined,
      bags: m.bags,
      amount: m.amount,
      buyer: m.buyer,
      invoiceId: m.invoiceId ?? undefined,
      by: m.by,
    })),
    financeEntries: financeEntries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      date: fromDbDate(e.date),
      kind: e.kind === "income" ? ("income" as const) : ("expense" as const),
      category: e.category,
      description: e.description,
      amount: e.amount,
      batch: e.batchCode ?? undefined,
      by: e.by,
    })),
    financeMonths,
    batchCosts: batches.map((b) => ({ batch: b.code, purchaseCost: b.purchaseCost, birdPrice: b.birdPrice })),
    broilerHouses: broilerHouses.map((h) => ({ code: h.code, unit: birdUnit(h.unit), capacity: h.capacity })),
    broilerBatchCosts: broilerBatches.map((b) => ({ batch: b.code, purchaseCost: b.purchaseCost, birdPrice: b.birdPrice })),
    broilerBatches: broilerBatches.map((b) => ({
      batch: b.code,
      unit: birdUnit(b.unit),
      createdAt: b.createdAt?.toISOString(),
      breed: b.breed,
      supplier: b.supplier,
      received: fromDbDate(b.received),
      ageOnArrival: b.ageOnArrival,
      chickWeight: b.chickWeight,
      birds: b.birds,
      house: b.houseCode ?? undefined,
      st: b.status,
      closedAt: b.closedAt ? fromDbDate(b.closedAt) : undefined,
    })),
    broilerDaily: broilerDaily.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      date: fromDbDate(r.date),
      batch: r.batchCode,
      feedKg: r.feedKg,
      product: r.productId ?? undefined,
      litres: r.litres,
      died: r.died,
      culled: r.culled,
      by: r.by,
    })),
    broilerWeighings: broilerWeighings.map((w) => ({
      id: w.id,
      createdAt: w.createdAt.toISOString(),
      date: fromDbDate(w.date),
      batch: w.batchCode,
      birds: w.birds,
      kg: w.kg,
      by: w.by,
    })),
    broilerSales: broilerSales.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      batch: x.batchCode,
      birds: x.birds,
      kg: x.kg,
      invoiceId: x.invoiceId,
      by: x.by,
    })),
    broilerFeedDeliveries: broilerFeedDeliveries.map((x) => ({
      unit: feedUnit(x.unit),
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      supplier: x.supplier,
      kg: x.kg,
      pricePerKg: x.pricePerKg,
      product: x.productId ?? undefined,
    })),
    broilerHealth: broilerHealth.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      batch: x.batchCode,
      kind: x.kind === "vaccine" ? ("vaccine" as const) : ("medication" as const),
      product: x.product,
      dosage: x.dosage,
      notes: x.notes,
      item: x.itemId ?? undefined,
      qty: x.qty,
      by: x.by,
    })),
    broilerProcessing: broilerProcessing.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      batch: x.batchCode,
      birds: x.birds,
      liveKg: x.liveKg,
      carcassKg: x.carcassKg,
      headFeetKg: x.headFeetKg,
      gizzardKg: x.gizzardKg,
      cost: x.cost,
      by: x.by,
    })),
    processedSales: processedSales.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      part: (x.part === "headfeet" || x.part === "gizzard" ? x.part : "carcass") as "carcass" | "headfeet" | "gizzard",
      kg: x.kg,
      pieces: x.pieces,
      invoiceId: x.invoiceId,
      by: x.by,
    })),
    broilerExpenses: broilerExpenses.map((x) => ({
      unit: feedUnit(x.unit),
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      category: x.category,
      description: x.description,
      amount: x.amount,
      batch: x.batchCode ?? undefined,
      by: x.by,
    })),
    broodingDispatches: broodingDispatches.map((x) => ({
      id: x.id,
      createdAt: x.createdAt.toISOString(),
      date: fromDbDate(x.date),
      batch: x.batchCode,
      birds: x.birds,
      kg: x.kg,
      layersBatch: x.layersBatch ?? undefined,
      broilerBatch: x.broilerBatch ?? undefined,
      by: x.by,
    })),
    animals: animals.map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      tag: a.tag,
      species: a.species,
      breed: a.breed,
      sex: a.sex === "male" ? ("male" as const) : ("female" as const),
      born: a.born ? fromDbDate(a.born) : undefined,
      joined: fromDbDate(a.joined),
      source: a.source === "born" ? ("born" as const) : ("bought" as const),
      dam: a.dam,
      pen: a.pen,
      purchaseCost: a.purchaseCost,
      status: (["sold", "died", "culled"].includes(a.status) ? a.status : "active") as "active" | "sold" | "died" | "culled",
      leftOn: a.leftOn ? fromDbDate(a.leftOn) : undefined,
      leftNote: a.leftNote,
      invoiceId: a.invoiceId ?? undefined,
      notes: a.notes,
    })),
    animalWeights: animalWeights.map((w) => ({
      id: w.id,
      createdAt: w.createdAt.toISOString(),
      date: fromDbDate(w.date),
      animal: w.animalId,
      kg: w.kg,
      by: w.by,
    })),
    animalHealth: animalHealth.map((h) => ({
      id: h.id,
      createdAt: h.createdAt.toISOString(),
      date: fromDbDate(h.date),
      animal: h.animalId,
      kind: (h.kind === "vaccine" || h.kind === "deworming" ? h.kind : "treatment") as "vaccine" | "treatment" | "deworming",
      product: h.product,
      dosage: h.dosage,
      notes: h.notes,
      item: h.itemId ?? undefined,
      qty: h.qty,
      by: h.by,
    })),
    ruminantFeed: ruminantFeed.map((f) => ({
      id: f.id,
      createdAt: f.createdAt.toISOString(),
      date: fromDbDate(f.date),
      species: f.species,
      kg: f.kg,
      product: f.productId ?? undefined,
      by: f.by,
    })),
  });
}

/**
 * What someone may see, by their roles — the rest never leaves the server.
 * The owner and farm-wide members see everything.
 */
function scopeData(g: Grants, d: ErpData): ErpData {
  if (isFarmWide(g) && !g.deny?.length) return d;
  const keep = <T,>(ok: boolean, rows: T[]) => (ok ? rows : []);
  const buyers = canSee(g, "eggsales") || canSee(g, "money") || canSee(g, "finance");
  // Finance works from the whole farm's books.
  const finance = canSee(g, "finance");
  // Broiler sales are for Broilers and for the sales unit.
  const broilers = canSee(g, "broilers") || canSee(g, "broilersales");
  const brooding = canSee(g, "brooding");
  const ruminants = canSee(g, "ruminants");
  // Broilers and Brooding share records: each sees its own unit's.
  const unitOk = (u: string) => (u === "brooding" ? brooding : u === "ruminants" ? ruminants : broilers);
  const unitOf = new Map(d.broilerBatches.map((b) => [b.batch, b.unit]));
  const batchOk = (r: { batch: string }) => unitOk(unitOf.get(r.batch) ?? "broilers");
  // Broiler staff see their own invoices, and the buyers to sell to.
  const invoices = buyers
    ? d.invoices
    : d.invoices.filter(
        (v) =>
          (broilers && BROILER_PRODUCTS.includes(v.product)) ||
          (brooding && v.product === PULLET_PRODUCT) ||
          (ruminants && RUMINANT_PRODUCTS.includes(v.product))
      );
  const invoiceIds = new Set(invoices.map((v) => v.id));
  const layers = canSee(g, "layers") || finance;
  // Brooding sends birds to Layers' halls.
  const halls = layers || canSee(g, "brooding");
  const mill = canSee(g, "feed") || finance;
  const feedSales = mill || canSee(g, "feedsales");
  const locations = locationsOf(g);
  const asks = requestDivisionsOf(g);
  const myDivisions = Object.keys(g.divisions);
  const sharesDivision = (m: Grants | null) => !!m && Object.keys(m.divisions).some((x) => myDivisions.includes(x));
  return {
    ...d,
    // Egg buyers, their orders, invoices and money.
    customers: keep(buyers || broilers || brooding || ruminants, d.customers),
    invoices,
    payments: d.payments.filter((p) => invoiceIds.has(p.invoiceId)),
    orders: keep(buyers, d.orders),
    proofs: buyers ? d.proofs : d.proofs.filter((p) => p.invoiceId !== undefined && invoiceIds.has(p.invoiceId)),
    // Layers operations.
    prodLog: keep(layers, d.prodLog),
    eggMoves: keep(layers, d.eggMoves),
    batches: keep(layers, d.batches),
    houses: keep(halls, d.houses),
    layersFeedDeliveries: keep(layers, d.layersFeedDeliveries),
    feedUse: keep(layers, d.feedUse),
    waterLogs: keep(layers, d.waterLogs),
    vaccinations: keep(layers, d.vaccinations),
    medications: keep(layers, d.medications),
    birdOuts: keep(layers, d.birdOuts),
    manure: keep(layers, d.manure),
    // What batches cost and the farm's expenses stay with Finance.
    financeEntries: keep(finance, d.financeEntries),
    financeMonths: keep(finance, d.financeMonths),
    batchCosts: keep(finance, d.batchCosts),
    broilerBatchCosts: keep(finance, d.broilerBatchCosts),
    // Broilers.
    // Brooding sends birds to Broilers' houses too.
    broilerHouses: d.broilerHouses.filter((x) => unitOk(x.unit) || (brooding && x.unit === "broilers")),
    broilerBatches: d.broilerBatches.filter((x) => unitOk(x.unit)),
    broilerDaily: d.broilerDaily.filter(batchOk),
    broilerWeighings: d.broilerWeighings.filter(batchOk),
    broilerSales: d.broilerSales.filter(batchOk),
    broilerFeedDeliveries: d.broilerFeedDeliveries.filter((x) => unitOk(x.unit)),
    broilerHealth: d.broilerHealth.filter(batchOk),
    broilerProcessing: d.broilerProcessing.filter(batchOk),
    processedSales: keep(broilers, d.processedSales),
    broilerExpenses: d.broilerExpenses.filter((x) => unitOk(x.unit)),
    broodingDispatches: keep(brooding, d.broodingDispatches),
    animals: keep(ruminants, d.animals),
    animalWeights: keep(ruminants, d.animalWeights),
    animalHealth: keep(ruminants, d.animalHealth),
    ruminantFeed: keep(ruminants, d.ruminantFeed),
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
    // …and the main store's, so health records can draw from it.
    invMoves: locations === null ? d.invMoves : d.invMoves.filter((m) => locations.includes(m.from ?? "") || locations.includes(m.to ?? "") || m.from === "store" || m.to === "store"),
    // People who share a division with them (and themselves); invites they could act on.
    staff: isFarmWide(g) ? d.staff : d.staff.filter((m) => m.id === d.viewer.id || sharesDivision(m.grants)),
    invites: isFarmWide(g) ? d.invites : d.invites.filter((i) => (i.grants ? sharesDivision(i.grants) : canSee(g, "eggsales"))),
  };
}
