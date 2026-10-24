import "server-only";

import { after } from "next/server";

import { prisma } from "@/lib/db";
import { appUrl, emailEnabled, esc, sendEmail } from "@/lib/email";
import { invNo, naira, PAYMENT_METHOD } from "@/lib/orders";

/**
 * Every email the app sends to people, in one place and one look. Each
 * returns the send result and never throws; most are queued with `later()`
 * so they go out after the response and never slow down or break a save.
 */

type Result = { ok: true } | { ok: false; error: string };

/** Runs an email after the response is sent. Failures are logged, never thrown. */
export function later(task: () => Promise<unknown>) {
  if (!emailEnabled()) return;
  after(async () => {
    try {
      await task();
    } catch (e) {
      console.error("email failed", e);
    }
  });
}

// ── Layout ───────────────────────────────────────────────────────────────────

type Mail = {
  /** What it is, for the email log. */
  kind: string;
  subject: string;
  /** First line, e.g. "Hello De-Luxe Bakery,". */
  greeting: string;
  /** Plain sentences; each becomes a paragraph. */
  lines: string[];
  /** Label / value pairs shown as a small table. */
  rows?: [string, string][];
  button?: { label: string; href: string };
  /** Small print under the button. */
  after?: string;
};

function render(m: Mail) {
  const rows = m.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0;border-collapse:collapse">${m.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #eef1ec;color:#647067;font-size:14px">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eef1ec;color:#14231a;font-size:14px;font-weight:600;text-align:right">${esc(v)}</td></tr>`
        )
        .join("")}</table>`
    : "";
  const button = m.button
    ? `<p style="margin:24px 0"><a href="${m.button.href}" style="display:inline-block;background:#2f8f46;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${esc(m.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7ebe6;border-radius:16px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eef1ec"><span style="display:inline-block;background:#2f8f46;color:#fff;font-weight:800;border-radius:9px;padding:5px 9px;font-size:14px">A</span><span style="font-size:17px;font-weight:800;color:#14231a;margin-left:9px">Argandu Farms</span></td></tr>
<tr><td style="padding:26px 28px;color:#14231a;font-size:15px;line-height:1.55">
<p style="margin:0 0 14px">${esc(m.greeting)}</p>
${m.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}
${rows}${button}
${m.after ? `<p style="margin:0;color:#8b958d;font-size:13px">${esc(m.after)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eef1ec;color:#8b958d;font-size:12px">An automatic message from Argandu Farms — replies to this address aren't read. Questions? Call the farm office.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    m.greeting,
    "",
    ...m.lines,
    ...(m.rows?.length ? ["", ...m.rows.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(m.button ? ["", `${m.button.label}: ${m.button.href}`] : []),
    ...(m.after ? ["", m.after] : []),
    "",
    "Argandu Farms",
  ].join("\n");
  return { html, text };
}

function send(to: string[], m: Mail): Promise<Result> {
  if (!emailEnabled()) return Promise.resolve({ ok: false, error: "Email isn't set up yet." });
  if (to.length === 0) return Promise.resolve({ ok: false, error: "No email address to send to." });
  return sendEmail({ to, subject: m.subject, kind: m.kind, ...render(m) });
}

/** The active portal logins for a buyer. */
async function buyerEmails(customerId: number) {
  const users = await prisma.user.findMany({
    where: { customerId, role: "customer", disabled: false },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

const portal = (path = "") => `${appUrl()}/portal${path}`;

// ── Accounts ─────────────────────────────────────────────────────────────────

export function mailInvite(i: { email: string; role: string; buyer?: string; path: string }) {
  const buyer = i.role === "customer";
  return send([i.email], {
    kind: "invite",
    subject: buyer ? "Your Argandu Farms buyer account" : "You've been added to the Argandu Farms ERP",
    greeting: "Hello,",
    lines: [
      buyer
        ? `You've been invited to order eggs${i.buyer ? ` for ${i.buyer}` : ""} on the Argandu Farms buyer portal.`
        : `You've been invited to join the Argandu Farms ERP as ${i.role === "admin" ? "an admin" : "staff"}.`,
      "Choose your password to get started.",
    ],
    button: { label: "Set your password", href: `${appUrl()}${i.path}` },
    after: "The link works once and expires in 7 days. If you weren't expecting this, ignore this email.",
  });
}

export function mailPasswordReset(u: { email: string; name: string; url: string }) {
  return send([u.email], {
    kind: "password-reset",
    subject: "Reset your Argandu Farms password",
    greeting: `Hello ${u.name},`,
    lines: ["Someone asked to reset the password for your Argandu Farms account."],
    button: { label: "Choose a new password", href: u.url },
    after: "The link works once and expires in 1 hour. If it wasn't you, ignore this email — your password stays the same.",
  });
}

export function mailPasswordChanged(u: { email: string; name: string }) {
  return send([u.email], {
    kind: "password-changed",
    subject: "Your Argandu Farms password was changed",
    greeting: `Hello ${u.name},`,
    lines: [
      "The password for your Argandu Farms account was just changed, and other devices were signed out.",
      "If that wasn't you, reset your password now and tell the farm office.",
    ],
  });
}

// ── Orders ───────────────────────────────────────────────────────────────────

async function orderFor(orderId: number) {
  return prisma.eggOrder.findUnique({
    where: { id: orderId },
    include: { customer: { select: { name: true } }, invoice: { include: { payments: true } } },
  });
}

const lagosTime = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Paid (online, from credit or confirmed by the farm): the order now goes to the farm. */
export async function mailOrderPaid(orderId: number, paidNow = 0) {
  const o = await orderFor(orderId);
  if (!o) return;
  const total = o.crates * (o.price ?? 0);
  await send(await buyerEmails(o.customerId), {
    kind: "order-paid",
    subject: `Order confirmed — ${o.crates} crates, paid`,
    greeting: `Hello ${o.customer.name},`,
    lines: [
      "Thank you — your order is paid for and with the farm now. We'll email you when it's on its way.",
    ],
    rows: [
      ["Order", `#${o.id}`],
      ["Crates", `${o.crates} × ${naira.format(o.price ?? 0)}`],
      ["Total", naira.format(total)],
      ...(paidNow && paidNow < total ? ([["Paid now", naira.format(paidNow)], ["From your credit", naira.format(total - paidNow)]] as [string, string][]) : []),
      ...(!paidNow ? ([["Paid", "From your credit"]] as [string, string][]) : []),
      ...(o.notes ? ([["Your note", o.notes]] as [string, string][]) : []),
    ],
    button: { label: "View your orders", href: portal("/orders") },
    after: "If the farm can't supply all of it, what isn't sent stays as your credit for the next order.",
  });
}

/** An order placed for the buyer (by staff) that they still need to pay for. */
export async function mailOrderAwaitingPayment(orderId: number, due: number) {
  const o = await orderFor(orderId);
  if (!o) return;
  await send(await buyerEmails(o.customerId), {
    kind: "order-awaiting-payment",
    subject: `Pay to confirm your order — ${o.crates} crates`,
    greeting: `Hello ${o.customer.name},`,
    lines: [
      `An order of ${o.crates} crates was placed for you. Pay for it to confirm it — orders go to the farm once they're paid.`,
      ...(o.payBy ? [`It holds your crates until ${lagosTime(o.payBy)}; after that it's released.`] : []),
    ],
    rows: [
      ["Crates", `${o.crates} × ${naira.format(o.price ?? 0)}`],
      ["To pay", naira.format(due)],
    ],
    button: { label: "Pay now", href: portal("/orders") },
  });
}

/** Fulfilled: what's coming, the invoice, and what's left to pay. */
export async function mailOrderFulfilled(orderId: number, remainder = 0) {
  const o = await orderFor(orderId);
  if (!o?.invoice) return;
  const v = o.invoice;
  const total = v.qty * v.price;
  const paid = v.payments.reduce((a, p) => a + p.amount, 0);
  const fromCredit = v.payments.filter((p) => p.method === "credit").reduce((a, p) => a + p.amount, 0);
  await send(await buyerEmails(o.customerId), {
    kind: "order-fulfilled",
    subject:
      total - paid > 0
        ? `Order fulfilled — ${invNo(v.id)}, ${naira.format(total - paid)} due`
        : `Your order is on its way — ${o.crates} crates (${invNo(v.id)})`,
    greeting: `Hello ${o.customer.name},`,
    lines: [
      `Your order of ${o.crates} crates has been fulfilled and is on its way.`,
      ...(remainder ? [`The other ${remainder} crates are still pending — we'll send them when we have the stock.`] : []),
      ...(total - paid > 0 ? ["Please pay the balance before Monday to keep ordering."] : ["It's fully paid — thank you."]),
    ],
    rows: [
      ["Invoice", invNo(v.id)],
      ["Amount", `${v.qty} × ${naira.format(v.price)} = ${naira.format(total)}`],
      ...(fromCredit ? ([["Paid from your credit", naira.format(fromCredit)]] as [string, string][]) : []),
      ["Balance due", naira.format(total - paid)],
    ],
    button: { label: total - paid > 0 ? "View and pay" : "View the invoice", href: portal("/payments") },
    after: "When the crates arrive, press Mark received on your Orders page.",
  });
}

export async function mailOrderDeclined(orderId: number) {
  const o = await orderFor(orderId);
  if (!o) return;
  await send(await buyerEmails(o.customerId), {
    kind: "order-declined",
    subject: `Order not fulfilled — ${o.crates} crates`,
    greeting: `Hello ${o.customer.name},`,
    lines: [
      `We're sorry — we couldn't fill your order of ${o.crates} crates placed on ${o.date.toISOString().slice(0, 10)}.`,
      ...(o.paidAt
        ? [
            `You'd paid ${naira.format(o.crates * (o.price ?? 0))} for it: that's kept as your credit and used on your next order — or ask the farm office for a refund.`,
          ]
        : []),
      "Those crates are back on your allocation if it's still the same week.",
    ],
    button: { label: "Order again", href: portal("/orders") },
  });
}

// ── Money ────────────────────────────────────────────────────────────────────

/** An invoice raised at the counter or resent by staff. */
export async function mailInvoice(invoiceId: number): Promise<Result> {
  const v = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!v?.customerId) return { ok: false, error: "Walk-in sales have no email to send to." };
  const to = await buyerEmails(v.customerId);
  if (to.length === 0) return { ok: false, error: `${v.name} has no portal login with an email.` };
  const total = v.qty * v.price;
  const due = total - v.payments.reduce((a, p) => a + p.amount, 0);
  return send(to, {
    kind: "invoice",
    subject: `Invoice ${invNo(v.id)} from Argandu Farms — ${naira.format(due)} due`,
    greeting: `Hello ${v.name},`,
    lines: [due > 0 ? "Here's your invoice." : "Here's your invoice — it's fully paid, thank you."],
    rows: [
      ["Invoice", invNo(v.id)],
      ["Item", `${v.qty} ${v.unit ?? "crates"} · ${v.product}`],
      ["Amount", naira.format(total)],
      ["Balance due", naira.format(due)],
    ],
    button: { label: due > 0 ? "View and pay" : "View the invoice", href: portal(`/invoices/${v.id}`) },
  });
}

/** A receipt for money received against an invoice. */
export async function mailPaymentReceipt(p: {
  invoiceId: number;
  amount: number;
  method: keyof typeof PAYMENT_METHOD;
  credit?: number;
}) {
  const v = await prisma.invoice.findUnique({ where: { id: p.invoiceId }, include: { payments: true } });
  if (!v?.customerId) return;
  const due = v.qty * v.price - v.payments.reduce((a, x) => a + x.amount, 0);
  await send(await buyerEmails(v.customerId), {
    kind: "payment-receipt",
    subject: `Payment received — ${naira.format(p.amount + (p.credit ?? 0))}`,
    greeting: `Hello ${v.name},`,
    lines: [
      `Thank you — we've received your payment for ${invNo(v.id)}.`,
      ...(p.credit ? [`${naira.format(p.credit)} over the balance is kept as credit for your next invoice.`] : []),
    ],
    rows: [
      ["Amount", naira.format(p.amount + (p.credit ?? 0))],
      ["Method", PAYMENT_METHOD[p.method]],
      ["Invoice", invNo(v.id)],
      ["Balance left", due > 0 ? naira.format(due) : "Paid in full"],
    ],
    button: { label: "View your payments", href: portal("/payments") },
  });
}

/** Money paid in advance (or not needed by an invoice) held as credit. */
export async function mailCreditReceipt(p: { customerId: number; amount: number; method: keyof typeof PAYMENT_METHOD }) {
  const [c, credit] = await Promise.all([
    prisma.customer.findUnique({ where: { id: p.customerId }, select: { name: true } }),
    prisma.customerCredit.aggregate({ where: { customerId: p.customerId }, _sum: { amount: true } }),
  ]);
  if (!c) return;
  await send(await buyerEmails(p.customerId), {
    kind: "credit-receipt",
    subject: `Payment received — ${naira.format(p.amount)} credit`,
    greeting: `Hello ${c.name},`,
    lines: [
      `Thank you — we've received ${naira.format(p.amount)} (${PAYMENT_METHOD[p.method].toLowerCase()}).`,
      "Anything you owed has been settled from it; the rest is credit used on your next invoices.",
    ],
    rows: [["Credit now", naira.format(Math.max(0, credit._sum.amount ?? 0))]],
    button: { label: "View your payments", href: portal("/payments") },
  });
}

// ── Admins ───────────────────────────────────────────────────────────────────

/** Every active admin, in the same layout. */
export async function mailAdmins(m: Omit<Mail, "greeting">): Promise<Result> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", disabled: false },
    select: { email: true },
  });
  return send(
    admins.map((a) => a.email),
    { ...m, greeting: "Hello," }
  );
}
