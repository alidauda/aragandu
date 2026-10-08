/**
 * Loads the demo farm into an EMPTY database and creates two demo logins.
 * Never run against production data: it refuses if any customer exists.
 *
 *   npm run db:seed
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { farmToday } from "../src/lib/dates";
import { createCredentialUser } from "../src/lib/users";
import * as demo from "./seed-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// Shift by whole weeks so weekdays (and so the debt gate's week boundaries)
// keep their shape, with the latest demo day at or just before today.
const weeks = Math.floor(
  (Date.parse(farmToday()) - Date.parse(demo.MOCK_TODAY)) / (7 * DAY_MS)
);
const d = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + weeks * 7 * DAY_MS);

async function main() {
  await prisma.$transaction(seed, { timeout: 60_000 });
}

async function seed(prisma: Prisma.TransactionClient) {
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, cratePrice: demo.CRATE_PRICE },
    update: {},
  });

  if ((await prisma.customer.count()) > 0) {
    console.log("Database already has customers — skipping demo data.");
    return;
  }

  await prisma.customer.createMany({
    data: demo.customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      weeklyCrates: c.alloc,
    })),
  });
  await prisma.ingredient.createMany({
    data: demo.ingredients.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.cat,
      reorderKg: i.reorder,
    })),
  });
  await prisma.ingredientDelivery.createMany({
    data: demo.deliveries.map((x) => ({
      date: d(x.date),
      ingredientId: x.ing,
      kg: x.kg,
      pricePerKg: x.price,
    })),
  });
  await prisma.feedProduct.createMany({
    data: demo.products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      bagKg: p.bag,
      price: p.price,
    })),
  });
  for (const r of demo.runs) {
    await prisma.productionRun.create({
      data: {
        id: r.id,
        code: r.run,
        date: d(r.date),
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
  }
  await prisma.house.createMany({ data: demo.houses });
  await prisma.batch.createMany({
    data: demo.batches.map((b) => ({
      code: b.batch,
      breed: b.breed,
      supplier: b.supplier,
      received: d(b.received),
      birds: b.birds,
      mortality: b.mortality,
      houseCode: b.house === "—" ? null : b.house,
      status: b.st,
    })),
  });
  await prisma.invItem.createMany({
    data: demo.invItems.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.cat,
      unit: i.unit,
      reorder: i.reorder,
      cost: i.cost,
    })),
  });
  await prisma.invMove.createMany({
    data: demo.invMoves.map((m) => ({
      date: d(m.date),
      itemId: m.item,
      fromLoc: m.from,
      toLoc: m.to,
      qty: m.qty,
      by: m.by,
    })),
  });
  await prisma.feedRequest.createMany({
    data: demo.seedReqs.map((q) => ({
      id: q.id,
      date: d(q.date),
      division: q.division,
      productId: q.product,
      bags: q.bags,
      requestedBy: q.by,
      status: q.status,
    })),
  });
  await prisma.feedSale.createMany({
    data: demo.seedFeedSales.map((s) => ({
      id: s.id,
      date: d(s.date),
      productId: s.product,
      channel: s.channel,
      buyer: s.buyer,
      bags: s.bags,
      price: s.price,
      requestId: s.reqId ?? null,
    })),
  });
  await prisma.eggProduction.createMany({
    data: demo.seedProdLog.map((p) => ({
      date: d(p.date),
      houseCode: p.house,
      eggs: p.eggs,
      cracked: p.cracked,
      rejects: p.rejects,
    })),
  });
  await prisma.eggMove.createMany({
    data: demo.seedEggMoves.map((m) => ({
      date: d(m.date),
      type: m.type,
      crates: m.crates,
    })),
  });
  await prisma.eggOrder.createMany({
    data: demo.seedOrders.map((o) => ({
      id: o.id,
      date: d(o.date),
      customerId: o.cust,
      crates: o.crates,
      status: o.status,
    })),
  });
  await prisma.invoice.createMany({
    data: demo.seedInvoices.map((v) => ({
      id: v.id,
      date: d(v.date),
      customerId: v.cust,
      name: v.name,
      product: v.product,
      qty: v.qty,
      unit: v.unit ?? null,
      price: v.price,
      status: v.status,
      orderId: v.orderId ?? null,
    })),
  });
  await prisma.layersFeedDelivery.createMany({
    data: demo.layersFeedDeliveries.map((x) => ({
      id: x.id,
      date: d(x.date),
      supplier: x.supplier,
      kg: x.kg,
    })),
  });
  await prisma.feedUse.createMany({
    data: demo.seedFeedUse.map((u) => ({
      date: d(u.date),
      houseCode: u.house,
      kg: u.kg,
    })),
  });
  await prisma.waterLog.createMany({
    data: demo.waterLogs.map((w) => ({
      date: d(w.date),
      houseCode: w.house,
      litres: w.litres,
    })),
  });
  await prisma.vaccination.createMany({
    data: demo.vaccinations.map((v) => ({
      date: d(v.date),
      itemId: v.item,
      batchCode: v.batch,
      houseCode: v.house,
      route: v.route,
      qtyUsed: v.qtyUsed,
      status: v.status,
    })),
  });
  await prisma.medication.createMany({
    data: demo.medications.map((m) => ({
      date: d(m.date),
      itemId: m.item,
      reason: m.reason,
      batchCode: m.batch,
      dosage: m.dosage,
      qtyUsed: m.qtyUsed,
      status: m.status,
    })),
  });

  // Rows above were inserted with explicit ids; move each sequence past them.
  for (const table of [
    "customers",
    "ingredients",
    "feed_products",
    "production_runs",
    "inv_items",
    "feed_requests",
    "feed_sales",
    "egg_orders",
    "invoices",
    "layers_feed_deliveries",
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT MAX(id) FROM "${table}"))`
    );
  }

  await createCredentialUser(prisma, {
    name: "A. Folawiyo",
    email: "staff@argandu.test",
    password: "afems-staff-demo",
    role: "staff",
  });
  await createCredentialUser(prisma, {
    name: "De-Luxe Bakery",
    email: "buyer@argandu.test",
    password: "afems-buyer-demo",
    role: "customer",
    customerId: 1,
  });

  console.log(`Demo farm loaded (dates shifted ${weeks} weeks).`);
  console.log("  Staff:  staff@argandu.test / afems-staff-demo");
  console.log("  Buyer:  buyer@argandu.test / afems-buyer-demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
