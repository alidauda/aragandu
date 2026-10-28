import type { Grants } from "@/lib/access";

/**
 * The ERP's client-side shapes. The server loads Postgres rows into these
 * (src/lib/erp/queries.ts) so screens and derivations stay storage-agnostic.
 * Dates are YYYY-MM-DD strings in the farm's calendar. `createdAt` is the
 * moment a record was entered (an ISO timestamp) — a record's `date` can be
 * an earlier day when it was entered late; absent for rows from before that
 * was tracked.
 */

import type { Role, TeamRole } from "@/lib/roles";
import type { InvCategory } from "./categories";
import type { Division } from "./divisions";

export type Customer = {
  id: number;
  name: string;
  alloc: number;
  phone: string;
  /** The portal logins linked to this buyer. */
  logins: BuyerLogin[];
  /** Credit held for this buyer (advances and overpayments), in naira. */
  credit: number;
  /** Removed but kept for the books (they have history). */
  archived: boolean;
  /** Their own crate price; absent = the farm's. */
  price?: number;
  /** Sales staff may upload payment receipts for them (admins always can). */
  staffReceipts: boolean;
  createdAt?: string;
};

export type Ingredient = {
  id: number;
  code: string;
  name: string;
  cat: "energy" | "protein" | "fibre" | "mineral" | "additive";
  reorder: number;
  createdAt?: string;
};

export type Delivery = { id: number; ing: number; date: string; kg: number; price: number; createdAt?: string };

export type Product = { id: number; sku: string; name: string; bag: number; price: number; createdAt?: string };

export type Run = {
  id: number;
  run: string;
  date: string;
  product: number;
  operator: string;
  output: number;
  /** [ingredientId, kg, pricePerKg snapshot] */
  lines: [number, number, number][];
  createdAt?: string;
};

export type Batch = {
  batch: string;
  breed: string;
  supplier: string;
  received: string;
  birds: number;
  /** Birds that have left: died, culled or sold. */
  mortality: number;
  /** Birds out by reason. */
  out: { died: number; culled: number; sold: number };
  /** When it started laying; absent = not in lay yet. */
  inLay?: string;
  /** Its houses, for display: "H-01, H-02", or "—" when not placed. */
  house: string;
  /** Birds in each house now (empty once closed). */
  placements: { house: string; birds: number }[];
  st: "active" | "closed";
  createdAt?: string;
};

export type InvItem = {
  id: number;
  sku: string;
  name: string;
  cat: InvCategory;
  unit: string;
  reorder: number;
  cost: number;
  /** Days after a dose before eggs can be sold. */
  withdrawalDays: number;
  expiresOn?: string;
  createdAt?: string;
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
  createdAt?: string;
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
  createdAt?: string;
};

export type FeedRequest = {
  id: number;
  date: string;
  division: Division;
  product: number;
  bags: number;
  by: string;
  status: "pending" | "fulfilled" | "declined";
  createdAt?: string;
};

export type ProdEntry = {
  id: number;
  date: string;
  house: string;
  eggs: number;
  cracked: number;
  rejects: number;
  /** Good eggs not sellable: the house was in a withdrawal period. */
  withheld: number;
  createdAt?: string;
};

export type EggMove = {
  id: number;
  date: string;
  type: "in" | "out";
  crates: number;
  reason: string;
  /** Pending write-offs wait for an admin and don't touch stock. */
  status: "approved" | "pending" | "rejected";
  requestedBy: string;
  reviewedBy?: string;
  createdAt?: string;
};

export type Invoice = {
  id: number;
  date: string;
  cust: number | null;
  name: string;
  product: string;
  qty: number;
  price: number;
  status: "paid" | "pending";
  /** When it became fully paid; absent while pending. */
  paidAt?: string;
  /** Total of its payments so far, in naira. */
  paid: number;
  unit?: string;
  orderId?: number;
  createdAt?: string;
};

export type EggOrder = {
  id: number;
  date: string;
  cust: number;
  crates: number;
  status: "pending" | "fulfilled" | "declined";
  notes: string;
  /** Crate price locked when the order was placed. */
  price?: number;
  /** The buyer confirmed the crates arrived. */
  deliveredAt?: string;
  /** Paid for (only paid orders can be fulfilled). */
  paidAt?: string;
  /** An unpaid order is released after this. */
  payBy?: string;
  /** Why it was declined, e.g. "Not paid in time". */
  declineReason?: string;
  createdAt?: string;
};

export type House = { code: string; capacity: number; createdAt?: string };

export type LayersFeedDelivery = {
  id: number;
  date: string;
  supplier: string;
  kg: number;
  pricePerKg: number;
  createdAt?: string;
};

export type FeedUse = { id: number; date: string; house: string; kg: number; createdAt?: string };

export type WaterLog = { id: number; date: string; house: string; litres: number; createdAt?: string };

/** Birds leaving a batch: died, culled or sold (with the sale invoice). */
export type BirdOut = {
  id: number;
  date: string;
  batch: string;
  /** The house they left. */
  house?: string;
  reason: "died" | "culled" | "sold";
  birds: number;
  invoiceId?: number;
  by: string;
  createdAt?: string;
};

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
  withdrawalUntil?: string;
  createdAt?: string;
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
  house?: string;
  withdrawalUntil?: string;
  createdAt?: string;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  /** The farm owner: only they manage admins, and no one can change them. */
  owner: boolean;
  /** All their roles (see src/lib/access.ts). */
  grants: Grants;
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
  /** A team invite's roles; null for a buyer invite. */
  grants: Grants | null;
  expires: string;
  createdAt?: string;
};

export type Payment = {
  id: number;
  invoiceId: number;
  date: string;
  amount: number;
  method: "transfer" | "cash" | "pos" | "credit" | "paystack";
  reference: string;
  by: string;
  createdAt?: string;
};

/** A buyer's receipt for a payment made outside the app (the file is at /api/proofs/:id). */
export type PaymentProof = {
  id: number;
  cust: number;
  orderId?: number;
  invoiceId?: number;
  amount: number;
  reference: string;
  note: string;
  fileName: string;
  mimeType: string;
  status: "submitted" | "accepted" | "rejected";
  rejectReason?: string;
  reviewedBy?: string;
  createdAt: string;
};

/** A tagged item on the asset register (a chair, a fan, a laptop…). */
export type Asset = {
  id: number;
  tag: string;
  name: string;
  location: string;
  condition: "good" | "fair" | "repair" | "damaged" | "lost";
  assignedTo: string;
  notes: string;
  /** Written off (sold, scrapped…): kept for the record. */
  disposedAt?: string;
  disposedNote?: string;
  createdAt: string;
  /** Newest first: added, moved, condition, edited, written off. */
  history: { at: string; by: string; kind: string; summary: string }[];
};

/** Everything the ERP screens read, loaded once per request by the layout. */
export type ErpData = {
  today: string;
  weekStart: string;
  viewer: {
    id: string;
    name: string;
    email: string;
    role: TeamRole;
    owner: boolean;
    /** All their roles (see src/lib/access.ts). */
    grants: Grants;
  };
  staff: StaffMember[];
  invites: PendingInvite[];
  cratePrice: number;
  /** Eggs in one crate. */
  eggsPerCrate: number;
  /** Kg in a bag of feed — Layers enter and see feed in bags. */
  feedBagKg: number;
  /** How buyers pay: online (Paystack) or manual (outside the app). */
  paymentMode: "online" | "manual";
  /** Anything else buyers should know about paying the farm directly. */
  paymentNote: string;
  /** Manual payments: the account buyers pay into. */
  bankName: string;
  accountName: string;
  accountNumber: string;
  /** Paystack's key is set on the server. */
  paystackReady: boolean;
  /** Outgoing email is configured (Zoho or Resend key + EMAIL_FROM). */
  emailEnabled: boolean;
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
  payments: Payment[];
  orders: EggOrder[];
  /** Buyers' receipts for payments made outside the app. */
  proofs: PaymentProof[];
  /** The asset register (farm-wide and the store keeper only). */
  assets: Asset[];
  feedUse: FeedUse[];
  invMoves: InvMove[];
  layersFeedDeliveries: LayersFeedDelivery[];
  waterLogs: WaterLog[];
  birdOuts: BirdOut[];
  vaccinations: VaccinationRec[];
  medications: MedicationRec[];
};
