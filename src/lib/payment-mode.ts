import "server-only";

import { prisma } from "@/lib/db";
import { paystackEnabled } from "@/lib/paystack";

export type PaymentMode = "online" | "manual";

/**
 * How buyers pay. "online": Paystack in the portal (when its key is set).
 * "manual": money is paid outside the app — transfer, cash, POS — and the
 * farm marks orders and invoices paid. `note` is what buyers are told
 * (bank, account name and number).
 */
export async function paymentSettings(): Promise<{ mode: PaymentMode; note: string }> {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { paymentMode: true, paymentNote: true },
  });
  return { mode: s?.paymentMode === "manual" ? "manual" : "online", note: s?.paymentNote ?? "" };
}

/** Whether the portal takes payments online right now. */
export async function onlinePayments() {
  return paystackEnabled() && (await paymentSettings()).mode === "online";
}
