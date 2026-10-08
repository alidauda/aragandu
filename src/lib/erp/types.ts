/**
 * The ERP's client-side shapes. The server loads Postgres rows into these
 * (src/lib/erp/queries.ts) so screens and derivations stay storage-agnostic.
 * Dates are YYYY-MM-DD strings in the farm's calendar.
 */

import type { Role, TeamRole } from "@/lib/roles";
import type { Division } from "./divisions";

export type Customer = {
  id: number;
  name: string;
  alloc: number;
  phone: string;
  /** The portal logins linked to this buyer. */
  logins: BuyerLogin[];
};

export type Ingredient = {
  id: number;
  code: string;
  name: string;
  cat: "energy" | "protein" | "fibre" | "mineral" | "additive";
  reorder: number;
};

export type Delivery = { id: number; ing: number; date: string; kg: number; price: number };

export type Product = { id: number; sku: string; name: string; bag: number; price: number };

export type Run = {
  id: number;
  run: string;
  date: string;
  product: number;
  operator: string;
  output: number;
  /** [ingredientId, kg, pricePerKg snapshot] */
  lines: [number, number, number][];
};

export type Batch = {
  batch: string;
  breed: string;
  supplier: string;
  received: string;
  birds: number;
  mortality: number;
  house: string;
  st: "active" | "closed";
};

export type InvItem = {
  id: number;
  sku: string;
  name: string;
  cat: "medication" | "equipment" | "packaging" | "supplies";
  unit: string;
  reorder: number;
  cost: number;
};

export type InvMove = {
  id: number;
  date: string;
  item: number;
  /** null = receipt from outside */
  from: string | null;
  /** null = consumed / written off ("used") */
  to: string | null;
  qty: number;
  by: string;
  /** A health record's draw: delete the health record, not the move. */
  health?: boolean;
};

export type FeedSale = {
  id: number;
  date: string;
  product: number;
  channel: "internal" | "external";
  buyer: string;
  bags: number;
  price: number;
  reqId?: number;
};

export type FeedRequest = {
  id: number;
  date: string;
  division: Division;
  product: number;
  bags: number;
  by: string;
  status: "pending" | "fulfilled" | "declined";
};

export type ProdEntry = {
  id: number;
  date: string;
  house: string;
  eggs: number;
  cracked: number;
  rejects: number;
};

export type EggMove = { id: number; date: string; type: "in" | "out"; crates: number };

export type Invoice = {
  id: number;
  date: string;
  cust: number | null;
  name: string;
  product: string;
  qty: number;
  price: number;
  status: "paid" | "pending";
  /** When it was marked paid; absent while pending. */
  paidAt?: string;
  unit?: string;
  orderId?: number;
};

export type EggOrder = {
  id: number;
  date: string;
  cust: number;
  crates: number;
  status: "pending" | "fulfilled" | "declined";
  notes: string;
};

export type House = { code: string; capacity: number };

export type LayersFeedDelivery = {
  id: number;
  date: string;
  supplier: string;
  kg: number;
};

export type FeedUse = { id: number; date: string; house: string; kg: number };

export type WaterLog = { id: number; date: string; house: string; litres: number };

export type VaccinationRec = {
  id: number;
  date: string;
  /** Central-inventory item id (Medication). */
  item: number;
  batch: string;
  house: string;
  route: string;
  qtyUsed: number;
  status: "done" | "due" | "overdue";
};

export type MedicationRec = {
  id: number;
  date: string;
  /** Central-inventory item id (Medication). */
  item: number;
  reason: string;
  batch: string;
  dosage: string;
  qtyUsed: number;
  status: "ongoing" | "completed";
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  disabled: boolean;
  since: string;
};

/** A portal login on a buyer's record. */
export type BuyerLogin = { userId: string; email: string; disabled: boolean };

/** An invite link that hasn't been used, revoked or expired yet. */
export type PendingInvite = {
  id: number;
  email: string;
  name: string;
  role: Role;
  customerId: number | null;
  expires: string;
};

/** Everything the ERP screens read, loaded once per request by the layout. */
export type ErpData = {
  today: string;
  weekStart: string;
  viewer: { id: string; name: string; email: string; role: TeamRole };
  staff: StaffMember[];
  invites: PendingInvite[];
  cratePrice: number;
  customers: Customer[];
  ingredients: Ingredient[];
  products: Product[];
  batches: Batch[];
  houses: House[];
  invItems: InvItem[];
  deliveries: Delivery[];
  runs: Run[];
  feedSales: FeedSale[];
  reqs: FeedRequest[];
  prodLog: ProdEntry[];
  eggMoves: EggMove[];
  invoices: Invoice[];
  orders: EggOrder[];
  feedUse: FeedUse[];
  invMoves: InvMove[];
  layersFeedDeliveries: LayersFeedDelivery[];
  waterLogs: WaterLog[];
  vaccinations: VaccinationRec[];
  medications: MedicationRec[];
};
