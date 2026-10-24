import { PAYMENT_METHOD } from "@/lib/orders";

/** The payment ledger's shapes and labels — shared by the server and the page. */

export type LedgerKind = "invoice" | "order" | "advance" | "overpayment" | "refund" | "credit-used";

export const LEDGER_KIND: Record<LedgerKind, string> = {
  invoice: "Invoice payment",
  order: "Order paid up front",
  advance: "Advance",
  overpayment: "Overpayment (credit)",
  refund: "Refund",
  "credit-used": "Credit used",
};

export type LedgerEntry = {
  key: string;
  date: string;
  /** When it was recorded, for ordering within a day. */
  at: string;
  buyer: string;
  kind: LedgerKind;
  /** + money in, − money out (refunds). Credit used is shown but isn't money. */
  amount: number;
  method: keyof typeof PAYMENT_METHOD | null;
  reference: string;
  /** "INV-00012" or "Order #34". */
  for: string;
  link: string | null;
  by: string;
};

export type OnlineAttempt = {
  reference: string;
  at: string;
  buyer: string;
  amount: number;
  status: string;
  for: string;
};

/** Money in, money out and the split by method, for a list of entries. */
export function ledgerTotals(entries: LedgerEntry[]) {
  const money = entries.filter((e) => e.kind !== "credit-used");
  const received = money.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const refunded = Math.abs(money.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0));
  const byMethod = (["transfer", "cash", "pos", "paystack"] as const).map((m) => ({
    method: m,
    label: PAYMENT_METHOD[m],
    amount: money.filter((e) => e.method === m && e.amount > 0).reduce((a, e) => a + e.amount, 0),
  }));
  const creditUsed = entries.filter((e) => e.kind === "credit-used").reduce((a, e) => a + e.amount, 0);
  return { received, refunded, net: received - refunded, byMethod, creditUsed };
}
