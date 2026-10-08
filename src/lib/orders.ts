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
};

export type PortalInvoice = {
  id: number;
  date: string;
  product: string;
  qty: number;
  unit: string;
  amount: number;
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

export function debtAmount(blocking: Pick<PortalInvoice, "amount">[]): number {
  return blocking.reduce((sum, s) => sum + s.amount, 0);
}

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
