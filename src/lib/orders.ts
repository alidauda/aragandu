/**
 * The egg-ordering rules, shared by the portal's display and the server's
 * enforcement (src/lib/egg-orders.ts):
 *
 * 1. ALLOCATION — a buyer may order up to their weekly crate cap, across as
 *    many orders as they like within the week (Mon–Sun).
 * 2. DEBT GATE — ANY unpaid invoice from a PREVIOUS week blocks new orders.
 */

export type EggOrderStatus = "pending" | "fulfilled" | "declined";

export type PortalOrder = {
  id: number;
  date: string;
  crates: number;
  status: EggOrderStatus;
  notes: string;
  /** Crate price locked when the order was placed. */
  price: number | null;
  /** When the buyer confirmed the crates arrived. */
  deliveredAt: string | null;
  /** The invoice raised when it was fulfilled. */
  invoiceId: number | null;
  /** Paid for — only then does it go to the farm. */
  paidAt: string | null;
  /** An unpaid order is released after this. */
  payBy: string | null;
  /** Why it was declined: "Not paid in time", "Cancelled by the buyer", … */
  declineReason: string | null;
};

export type PortalPayment = {
  id: number;
  date: string;
  invoiceId: number;
  amount: number;
  method: "transfer" | "cash" | "pos" | "credit" | "paystack";
  reference: string;
};

/** A line on the buyer's credit account: + money in, − credit used. */
export type PortalCredit = { id: number; date: string; amount: number; note: string };

export const PAYMENT_METHOD = {
  transfer: "Bank transfer",
  cash: "Cash",
  pos: "POS",
  credit: "From credit",
  paystack: "Paid online",
} as const;

export type PortalInvoice = {
  id: number;
  date: string;
  product: string;
  qty: number;
  unit: string;
  amount: number;
  /** Paid so far; the balance is amount − paid. */
  paid: number;
  status: "paid" | "pending";
};

/** Crates already claimed this week (declined orders don't count). */
export function cratesOrderedInWeek(
  orders: Pick<PortalOrder, "date" | "crates" | "status">[],
  weekStart: string
): number {
  return orders
    .filter((o) => o.date >= weekStart && o.status !== "declined")
    .reduce((sum, o) => sum + o.crates, 0);
}

export function allocationLeft(weeklyCrates: number, orderedThisWeek: number): number {
  return Math.max(0, weeklyCrates - orderedThisWeek);
}

/** Unpaid invoices from weeks BEFORE `weekStart` — what blocks. */
export function blockingDebt<T extends Pick<PortalInvoice, "date" | "status">>(
  invoices: T[],
  weekStart: string
): T[] {
  return invoices.filter((s) => s.status === "pending" && s.date < weekStart);
}

export function debtAmount(blocking: Pick<PortalInvoice, "amount" | "paid">[]): number {
  return blocking.reduce((sum, s) => sum + s.amount - s.paid, 0);
}

/** "07 Oct" */
export const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export const invNo = (id: number) => `INV-${String(id).padStart(5, "0")}`;

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
