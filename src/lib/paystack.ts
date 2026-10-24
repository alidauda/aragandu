import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/audit";
import { farmToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { markOrderPaidIfCovered } from "@/lib/egg-orders";
import { addCredit, receiveAdvance, receivePayment } from "@/lib/money";
import { later, mailCreditReceipt, mailOrderPaid, mailPaymentReceipt } from "@/lib/mail";
import { alertAdmins, notifyNewOrder } from "@/lib/notify";
import { naira } from "@/lib/orders";

/**
 * Online payment through Paystack's hosted checkout. The buyer pays on
 * Paystack's page; we never see card details. Money is only recorded after
 * we ask Paystack to verify the transaction — never on the word of the
 * browser redirect alone.
 */

const API = "https://api.paystack.co";

/** Online payment is offered only when the secret key is set. */
export const paystackEnabled = () => Boolean(process.env.PAYSTACK_SECRET_KEY);

export class PaystackError extends Error {}

async function call<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status || body.data === undefined) {
    throw new PaystackError(body?.message ?? `Paystack returned ${res.status}.`);
  }
  return body.data;
}

/** A fresh reference for one checkout attempt (AF-… for an invoice, AO-… for an order). */
export const newReference = (id: number, kind: "invoice" | "order" = "invoice") =>
  `${kind === "order" ? "AO" : "AF"}-${id}-${randomBytes(6).toString("hex")}`;

/**
 * Starts a checkout for an invoice balance or an order, remembering it so
 * the payment is matched when Paystack confirms it. Returns the URL.
 */
export async function startCheckout(p: {
  customerId: number;
  email: string;
  amount: number;
  invoiceId?: number;
  orderId?: number;
  callbackUrl: string;
}) {
  const reference = newReference(p.orderId ?? p.invoiceId ?? 0, p.orderId ? "order" : "invoice");
  await prisma.paystackCharge.create({
    data: {
      reference,
      invoiceId: p.invoiceId ?? null,
      orderId: p.orderId ?? null,
      customerId: p.customerId,
      amount: p.amount,
      email: p.email,
    },
  });
  const checkout = await initializeCharge({
    email: p.email,
    amount: p.amount,
    reference,
    callbackUrl: p.callbackUrl,
    metadata: { customerId: p.customerId, invoiceId: p.invoiceId ?? null, orderId: p.orderId ?? null },
  });
  return checkout.authorization_url;
}

/** Starts a checkout; the buyer is sent to the returned URL. Amounts are naira. */
export async function initializeCharge(p: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: p.email,
      amount: p.amount * 100, // kobo
      currency: "NGN",
      reference: p.reference,
      callback_url: p.callbackUrl,
      metadata: p.metadata,
    },
  });
}

type Verified = {
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  amount: number; // kobo
  currency: string;
  channel: string;
  paid_at: string | null;
  reference: string;
};

/** Paystack signs each webhook with HMAC-SHA512 of the raw body and the secret key. */
export function validSignature(raw: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SettleResult = "paid" | "pending" | "failed" | "unknown";

/**
 * Records a checkout's money once Paystack confirms it. Called by both the
 * buyer's return from checkout and Paystack's webhook — whichever comes
 * first records it; the other finds it done.
 *
 * The money goes on the invoice (anything over the balance becomes credit).
 * If the invoice was paid another way or deleted in the meantime, all of it
 * becomes the buyer's credit — nothing paid is ever lost.
 */
export async function settleCharge(reference: string): Promise<SettleResult> {
  const charge = await prisma.paystackCharge.findUnique({ where: { reference } });
  if (!charge) return "unknown";
  if (charge.status === "paid") return "paid";

  const tx = await call<Verified>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== "success") {
    if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
      await prisma.paystackCharge.updateMany({
        where: { reference, status: "pending" },
        data: { status: tx.status },
      });
      return "failed";
    }
    return "pending";
  }
  if (tx.currency !== "NGN") throw new PaystackError(`Unexpected currency ${tx.currency} on ${reference}.`);

  const amount = Math.round(tx.amount / 100);
  const ref = `Paystack ${reference}`;
  const settled = await prisma.$transaction(async (db) => {
    // The row lock makes the callback and the webhook take turns.
    const rows = await db.$queryRaw<{ status: string; invoiceId: number | null; orderId: number | null }[]>`
      SELECT status, "invoiceId", "orderId" FROM paystack_charges WHERE reference = ${reference} FOR UPDATE`;
    if (!rows[0] || rows[0].status === "paid") return null;
    const today = farmToday();
    const markCharge = () =>
      db.paystackCharge.update({
        where: { reference },
        data: {
          status: "paid",
          paidAmount: amount,
          channel: tx.channel,
          paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date(),
        },
      });

    // Paying for an order up front: the money is the buyer's credit, held
    // for the order, which now goes to the farm.
    const orderId = rows[0].orderId;
    if (orderId) {
      await addCredit(db, charge.customerId, amount, {
        today,
        by: "Paystack",
        note: `Paid online for order #${orderId} (Paystack ${reference})`,
        kind: "order",
        method: "paystack",
        orderId,
      });
      const orderPaid = await markOrderPaidIfCovered(db, orderId);
      await markCharge();
      return { invoiceId: null, credit: orderPaid ? 0 : amount, orderId, orderPaid };
    }

    const inv = rows[0].invoiceId
      ? await db.invoice.findUnique({ where: { id: rows[0].invoiceId }, select: { id: true, status: true } })
      : null;
    let credit = 0;
    if (inv?.status === "pending") {
      credit = (await receivePayment(db, inv.id, amount, { method: "paystack", reference: ref, today, by: "Paystack" }))
        .credit;
    } else {
      credit = amount;
      await receiveAdvance(db, charge.customerId, amount, {
        method: "paystack",
        reference: ref,
        today,
        by: "Paystack",
        note: `Paystack ${reference} — invoice already settled, kept as credit`,
      });
    }
    await markCharge();
    return { invoiceId: inv?.id ?? null, credit, orderId: null, orderPaid: false };
  });

  if (settled) {
    const inv = settled.orderId
      ? `order #${settled.orderId}`
      : settled.invoiceId
        ? `INV-${String(settled.invoiceId).padStart(5, "0")}`
        : "no invoice";
    const customer = await prisma.customer.findUnique({ where: { id: charge.customerId }, select: { name: true } });
    const summary = `${naira.format(amount)} from ${customer?.name ?? "a buyer"} · ${inv} · ${tx.channel}${
      settled.credit ? ` · ${naira.format(settled.credit)} kept as credit` : ""
    }`;
    await audit({ userId: null, actor: "Paystack", action: "paystackPayment", summary, details: { reference } });
    void alertAdmins("Payment received online", `${summary}. Reference ${reference}.`);
    // The buyer's receipt: the order confirmed, the invoice paid, or credit.
    const { invoiceId, orderId, orderPaid } = settled;
    if (orderId && orderPaid) {
      later(() => mailOrderPaid(orderId, amount));
      later(() => notifyNewOrder(orderId));
    } else {
      later(() =>
        invoiceId
          ? mailPaymentReceipt({ invoiceId, amount: amount - settled.credit, method: "paystack", credit: settled.credit })
          : mailCreditReceipt({ customerId: charge.customerId, amount, method: "paystack" })
      );
    }
  }
  return "paid";
}
