import "server-only";

import { prisma } from "@/lib/db";
import { paystackEnabled } from "@/lib/paystack";

export type PaymentMode = "online" | "manual";

/** The account buyers pay into when paying outside the app. */
export type PayTo = { bankName: string; accountName: string; accountNumber: string; note: string };

/**
 * How buyers pay. "online": Paystack in the portal (when its key is set) —
 * the provider takes the money, so no account details are needed.
 * "manual": money is paid outside the app into the farm's account, and
 * staff mark orders and invoices paid.
 */
export async function paymentSettings(): Promise<{ mode: PaymentMode } & PayTo> {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { paymentMode: true, bankName: true, accountName: true, accountNumber: true, paymentNote: true },
  });
  return {
    mode: s?.paymentMode === "manual" ? "manual" : "online",
    bankName: s?.bankName ?? "",
    accountName: s?.accountName ?? "",
    accountNumber: s?.accountNumber ?? "",
    note: s?.paymentNote ?? "",
  };
}

/** Whether the portal takes payments online right now. */
export async function onlinePayments() {
  return paystackEnabled() && (await paymentSettings()).mode === "online";
}

/** "GTBank · Argandu Farms Ltd · 0123456789", for emails. */
export const payToLine = (p: PayTo) =>
  [p.bankName, p.accountName, p.accountNumber].filter((x) => x.trim()).join(" · ");
