/**
 * Demo data for local development, loaded by prisma/seed.ts. It was the
 * ERP's UI-phase mock database; seed.ts shifts every date by whole weeks so
 * the latest day lands near today.
 */

import type {
  Batch,
  Customer,
  Delivery,
  EggMove,
  EggOrder,
  FeedRequest,
  FeedSale,
  FeedUse,
  House,
  Ingredient,
  InvItem,
  InvMove,
  Invoice,
  LayersFeedDelivery,
  MedicationRec,
  ProdEntry,
  Product,
  Run,
  VaccinationRec,
  WaterLog,
} from "../src/lib/erp/types";

/** The frozen "today" these dates were written around. */
export const MOCK_TODAY = "2026-08-08";

export const customers: Omit<Customer, "logins" | "credit">[] = [
  { id: 1, name: "De-Luxe Bakery", alloc: 40, phone: "0803 445 1120" },
  { id: 2, name: "Mama Nkechi Stores", alloc: 25, phone: "0805 992 7714" },
  { id: 3, name: "Adewale & Sons", alloc: 30, phone: "0812 330 0287" },
  { id: 4, name: "Grace Supermart", alloc: 20, phone: "0809 118 6653" },
];

export const ingredients: Ingredient[] = [
  { id: 1, code: "ING-MAIZE", name: "Maize", cat: "energy", reorder: 2000 },
  { id: 2, code: "ING-SBM", name: "Soybean Meal", cat: "protein", reorder: 800 },
  { id: 3, code: "ING-WB", name: "Wheat Bran", cat: "fibre", reorder: 800 },
  { id: 4, code: "ING-LIME", name: "Limestone", cat: "mineral", reorder: 400 },
  { id: 5, code: "ING-PMX", name: "Layer Premix", cat: "additive", reorder: 40 },
  { id: 6, code: "ING-FISH", name: "Fish Meal", cat: "protein", reorder: 300 },
];

export const deliveries: Omit<Delivery, "id">[] = [
  { ing: 1, date: "2026-07-10", kg: 3000, price: 405 },
  { ing: 1, date: "2026-08-03", kg: 3000, price: 425 },
  { ing: 2, date: "2026-07-14", kg: 2400, price: 770 },
  { ing: 3, date: "2026-07-08", kg: 2000, price: 238 },
  { ing: 4, date: "2026-07-08", kg: 1200, price: 88 },
  { ing: 5, date: "2026-07-05", kg: 100, price: 3150 },
  { ing: 6, date: "2026-07-12", kg: 600, price: 1480 },
];

export const products: Product[] = [
  { id: 1, sku: "LAYER-MASH", name: "Layer Mash", bag: 25, price: 14500 },
  { id: 2, sku: "BROILER-START", name: "Broiler Starter", bag: 25, price: 16800 },
  { id: 3, sku: "GROWER-MASH", name: "Grower Mash", bag: 25, price: 15200 },
];

export const runs: Run[] = [
  {
    id: 1, run: "PR-2607-18", date: "2026-07-18", product: 1, operator: "Musa I.", output: 1960,
    lines: [[1, 1180, 410], [2, 400, 760], [3, 200, 235], [4, 150, 88], [5, 25, 3150], [6, 50, 1480]],
  },
  {
    id: 2, run: "PR-2608-01", date: "2026-08-01", product: 1, operator: "Musa I.", output: 1985,
    lines: [[1, 1200, 418], [2, 410, 780], [3, 205, 240], [4, 150, 90], [5, 25, 3200], [6, 50, 1500]],
  },
  {
    id: 3, run: "PR-2608-05", date: "2026-08-05", product: 2, operator: "Kunle A.", output: 1470,
    lines: [[1, 850, 418], [2, 420, 780], [3, 60, 240], [4, 45, 90], [5, 20, 3200], [6, 105, 1500]],
  },
  {
    id: 4, run: "PR-2608-07", date: "2026-08-07", product: 1, operator: "Musa I.", output: 1990,
    lines: [[1, 1195, 425], [2, 405, 780], [3, 200, 240], [4, 150, 90], [5, 25, 3200], [6, 50, 1480]],
  },
];

export const batches: Omit<Batch, "out">[] = [
  { batch: "B-2601", breed: "ISA Brown", supplier: "Zartech", received: "2026-01-12", birds: 2400, mortality: 62, house: "H-01", st: "active" },
  { batch: "B-2604", breed: "Lohmann Brown", supplier: "CHI Farms", received: "2026-04-02", birds: 2300, mortality: 38, house: "H-02", st: "active" },
  { batch: "B-2519", breed: "ISA Brown", supplier: "Zartech", received: "2025-05-20", birds: 2200, mortality: 214, house: "—", st: "closed" },
];

export const invItems: Omit<InvItem, "withdrawalDays">[] = [
  { id: 1, sku: "MED-LASOTA", name: "Lasota Vaccine", cat: "medication", unit: "vials", reorder: 20, cost: 1800 },
  { id: 2, sku: "MED-OXY", name: "Oxytetracycline 20%", cat: "medication", unit: "litres", reorder: 10, cost: 9500 },
  { id: 3, sku: "PKG-CRATE", name: "Egg Crates (paper)", cat: "packaging", unit: "pcs", reorder: 500, cost: 350 },
  { id: 4, sku: "SUP-DISF", name: "Disinfectant (Virkon)", cat: "supplies", unit: "kg", reorder: 15, cost: 12000 },
  { id: 5, sku: "EQP-DRINK", name: "Bell Drinkers", cat: "equipment", unit: "pcs", reorder: 10, cost: 4500 },
  { id: 6, sku: "SUP-SHAV", name: "Wood Shavings", cat: "supplies", unit: "bags", reorder: 40, cost: 1500 },
];

export const invMoves: Omit<InvMove, "id">[] = [
  { date: "2026-07-10", item: 5, from: null, to: "store", qty: 24, by: "K. Adamu" },
  { date: "2026-07-12", item: 6, from: null, to: "store", qty: 120, by: "K. Adamu" },
  { date: "2026-07-15", item: 1, from: null, to: "store", qty: 60, by: "K. Adamu" },
  { date: "2026-07-20", item: 3, from: null, to: "store", qty: 2000, by: "K. Adamu" },
  { date: "2026-07-22", item: 2, from: null, to: "store", qty: 12, by: "K. Adamu" },
  { date: "2026-07-28", item: 4, from: null, to: "store", qty: 25, by: "K. Adamu" },
  { date: "2026-08-01", item: 6, from: "store", to: "broilers", qty: 60, by: "T. Eze" },
  { date: "2026-08-02", item: 1, from: "store", to: "layers", qty: 25, by: "B. Okon" },
  { date: "2026-08-03", item: 2, from: "store", to: "ruminants", qty: 12, by: "T. Eze" },
  { date: "2026-08-04", item: 3, from: "store", to: "layers", qty: 800, by: "B. Okon" },
  { date: "2026-08-05", item: 4, from: "store", to: "broilers", qty: 12, by: "T. Eze" },
  { date: "2026-08-06", item: 2, from: "ruminants", to: null, qty: 12, by: "T. Eze" },
  { date: "2026-08-06", item: 6, from: "broilers", to: null, qty: 30, by: "T. Eze" },
  { date: "2026-08-07", item: 4, from: "broilers", to: null, qty: 12, by: "T. Eze" },
  { date: "2026-08-08", item: 1, from: "layers", to: null, qty: 18, by: "B. Okon" },
];

// ── Mutable-by-actions seeds (held in the store) ────────────────────────────

export const seedFeedSales: FeedSale[] = [
  { id: 1, date: "2026-07-20", product: 1, channel: "internal", buyer: "Layers", bags: 55, price: 14200 },
  { id: 2, date: "2026-08-02", product: 1, channel: "internal", buyer: "Layers", bags: 60, price: 14500, reqId: 2 },
  { id: 3, date: "2026-08-04", product: 1, channel: "external", buyer: "Green Acres Farm", bags: 20, price: 15500 },
  { id: 4, date: "2026-08-06", product: 2, channel: "internal", buyer: "Broilers", bags: 30, price: 16800 },
];

export const seedReqs: FeedRequest[] = [
  { id: 1, date: "2026-08-07", division: "broilers", product: 2, bags: 25, by: "T. Eze", status: "pending" },
  { id: 2, date: "2026-08-02", division: "layers", product: 1, bags: 60, by: "B. Okon", status: "fulfilled" },
  { id: 3, date: "2026-08-08", division: "layers", product: 1, bags: 40, by: "B. Okon", status: "pending" },
];

export const seedProdLog: Omit<ProdEntry, "id" | "withheld">[] = [
  { date: "2026-08-08", house: "H-02", eggs: 1965, cracked: 14, rejects: 6 },
  { date: "2026-08-08", house: "H-01", eggs: 2088, cracked: 18, rejects: 9 },
  { date: "2026-08-07", house: "H-02", eggs: 1978, cracked: 11, rejects: 4 },
  { date: "2026-08-07", house: "H-01", eggs: 2102, cracked: 22, rejects: 7 },
  { date: "2026-08-06", house: "H-02", eggs: 1940, cracked: 16, rejects: 5 },
  { date: "2026-08-06", house: "H-01", eggs: 2075, cracked: 12, rejects: 11 },
  { date: "2026-08-05", house: "H-02", eggs: 1990, cracked: 9, rejects: 3 },
  { date: "2026-08-05", house: "H-01", eggs: 2110, cracked: 15, rejects: 8 },
];

export const seedEggMoves: Pick<EggMove, "date" | "type" | "crates">[] = [
  { date: "2026-08-04", type: "in", crates: 130 },
  { date: "2026-08-06", type: "in", crates: 96 },
  { date: "2026-08-08", type: "in", crates: 74 },
  { date: "2026-08-05", type: "out", crates: 6 },
];

export const seedInvoices: Omit<Invoice, "paid">[] = [
  { id: 1, date: "2026-07-21", cust: 3, name: "Adewale & Sons", product: "Eggs (crates)", qty: 30, price: 6200, status: "pending" },
  { id: 2, date: "2026-07-28", cust: 3, name: "Adewale & Sons", product: "Eggs (crates)", qty: 25, price: 6200, status: "pending" },
  { id: 3, date: "2026-07-30", cust: 4, name: "Grace Supermart", product: "Spent hens", qty: 120, price: 3500, status: "paid", unit: "birds" },
  { id: 4, date: "2026-08-01", cust: 1, name: "De-Luxe Bakery", product: "Eggs (crates)", qty: 20, price: 6500, status: "paid" },
  { id: 5, date: "2026-08-04", cust: 2, name: "Mama Nkechi Stores", product: "Eggs (crates)", qty: 25, price: 6500, status: "paid", orderId: 1039 },
  { id: 6, date: "2026-08-05", cust: null, name: "Chuka Obi (walk-in)", product: "Eggs (crates)", qty: 8, price: 6500, status: "paid" },
  { id: 7, date: "2026-08-06", cust: 4, name: "Grace Supermart", product: "Eggs (crates)", qty: 15, price: 6500, status: "pending", orderId: 1043 },
];

export const seedOrders: Omit<EggOrder, "notes">[] = [
  { id: 1041, date: "2026-08-05", cust: 1, crates: 20, status: "pending" },
  { id: 1042, date: "2026-08-06", cust: 3, crates: 18, status: "pending" },
  { id: 1039, date: "2026-08-03", cust: 2, crates: 25, status: "fulfilled" },
  { id: 1043, date: "2026-08-04", cust: 4, crates: 15, status: "fulfilled" },
];

export const CRATE_PRICE = 6500;

// ── Layers: houses, feed ledgers, water, health ─────────────────────────────

/** External purchases only — feed from the mill arrives via internal feed
 *  sales (buyer "Layers") and is derived, not duplicated here. */
export const layersFeedDeliveries: Omit<LayersFeedDelivery, "pricePerKg">[] = [
  { id: 1, date: "2026-07-15", supplier: "AgroFeeds Ltd", kg: 3000 },
  { id: 2, date: "2026-07-25", supplier: "Northern Mills", kg: 4000 },
];

export const vaccinations: Omit<VaccinationRec, "id">[] = [
  { date: "2026-08-08", item: 1, batch: "B-2604", house: "H-02", route: "Drinking water", qtyUsed: 18, status: "done" },
  { date: "2026-07-28", item: 1, batch: "B-2601", house: "H-01", route: "Drinking water", qtyUsed: 17, status: "done" },
  { date: "2026-08-15", item: 1, batch: "B-2601", house: "H-01", route: "Drinking water", qtyUsed: 0, status: "due" },
];

export const medications: Omit<MedicationRec, "id">[] = [
  { date: "2026-08-03", item: 2, reason: "Respiratory signs, cage row 4", batch: "B-2604", dosage: "1 ml/L, 5 days", qtyUsed: 4, status: "ongoing" },
  { date: "2026-07-18", item: 2, reason: "Post-vaccination cover", batch: "B-2601", dosage: "0.5 ml/L, 3 days", qtyUsed: 3, status: "completed" },
];

export const houses: House[] = [
  { code: "H-01", capacity: 2500 },
  { code: "H-02", capacity: 2500 },
  { code: "H-03", capacity: 3000 },
];

export const seedFeedUse: Omit<FeedUse, "id">[] = [
  { date: "2026-08-08", house: "H-01", kg: 265 },
  { date: "2026-08-08", house: "H-02", kg: 250 },
  { date: "2026-08-07", house: "H-01", kg: 268 },
  { date: "2026-08-07", house: "H-02", kg: 252 },
  { date: "2026-08-06", house: "H-01", kg: 262 },
  { date: "2026-08-06", house: "H-02", kg: 248 },
  { date: "2026-08-05", house: "H-01", kg: 270 },
  { date: "2026-08-05", house: "H-02", kg: 255 },
];

export const waterLogs: Omit<WaterLog, "id">[] = [
  { date: "2026-08-08", house: "H-01", litres: 1240 },
  { date: "2026-08-08", house: "H-02", litres: 1180 },
  { date: "2026-08-07", house: "H-01", litres: 1255 },
  { date: "2026-08-07", house: "H-02", litres: 1165 },
  { date: "2026-08-06", house: "H-01", litres: 1230 },
  { date: "2026-08-06", house: "H-02", litres: 1190 },
];
