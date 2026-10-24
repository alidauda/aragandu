"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Egg, ReceiptText, Wallet } from "lucide-react";

import { confirmReceived, payInvoice, placeOrder } from "@/app/portal/actions";
import {
  invNo,
  naira,
  PAYMENT_METHOD,
  shortDate,
  type PortalCredit,
  type PortalInvoice,
  type PortalOrder,
  type PortalPayment,
} from "@/lib/orders";
import { Badge, Card, CardTitle, ForestTile, Kpi, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

/** The pieces the buyer's Dashboard, Orders and Payments pages share. */


const TONES = {
  green: { bg: "#e7f4ea", fg: "#23753a" },
  amber: { bg: "#fcf2de", fg: "#9a6a12" },
  red: { bg: "#fbeae7", fg: "#c7402f" },
  gray: { bg: "#eef1ec", fg: "#647067" },
} as const;

function Pill({ label, tone }: { label: string; tone: keyof typeof TONES }) {
  return <Badge label={label} bg={TONES[tone].bg} fg={TONES[tone].fg} />;
}

const ICONS = { egg: Egg, receipt: ReceiptText, wallet: Wallet };

/** A headline figure; server pages name the icon instead of passing it. */
export function Tile({
  icon,
  forest = false,
  ...kpi
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: keyof typeof ICONS;
  forest?: boolean;
}) {
  const Icon = icon ? ICONS[icon] : undefined;
  return forest ? <ForestTile {...kpi} icon={Icon} /> : <Kpi {...kpi} icon={Icon} />;
}

/** After Paystack sends the buyer back: paid, still confirming, or failed. */
export function PaymentNotice({ result }: { result?: string }) {
  if (!result) return null;
  const tone =
    result === "paid"
      ? "bg-[#e7f4ea] text-[#23753a]"
      : result === "failed"
        ? "bg-[#fbeae7] text-[#8a2f22]"
        : "bg-[#fcf2de] text-[#7a5410]";
  return (
    <p className={`mb-5 rounded-2xl px-4 py-3 text-[14px] ${tone}`}>
      {result === "paid"
        ? "Payment received — thank you. Your invoice is updated."
        : result === "failed"
          ? "The payment didn't go through and nothing was charged. You can try again."
          : "We're confirming your payment with Paystack. It will show here within a few minutes."}
    </p>
  );
}

/** Last week's unpaid balance pauses ordering. */
export function DebtBanner({ owed, count, payOnline }: { owed: number; count: number; payOnline: boolean }) {
  if (count === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0cfc9] bg-[#fbeae7] px-4 py-3 text-[14px] text-[#8a2f22]">
      <span>
        Ordering is paused: <strong>{naira.format(owed)}</strong> is unpaid on {count} invoice
        {count > 1 ? "s" : ""} from previous weeks.{" "}
        {payOnline ? "Pay it online and ordering reopens straight away." : "It reopens once the farm records your payment."}
      </span>
      <Link
        href="/portal/payments"
        className="rounded-[10px] bg-[#c7402f] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#ad3527]"
      >
        {payOnline ? "Pay now" : "See invoices"}
      </Link>
    </div>
  );
}

const inputCls =
  "mt-1 block rounded-[10px] border border-[#dce1da] bg-white px-3 py-2.5 text-[14px] text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-2 focus:ring-[#2f8f46]/15";

/** Crates + note. The allocation and debt rules are enforced on the server too. */
export function OrderForm({
  left,
  weeklyCrates,
  cratePrice,
  blocked,
}: {
  left: number;
  weeklyCrates: number;
  cratePrice: number;
  blocked: boolean;
}) {
  const [crates, setCrates] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [placing, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(crates);
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number of crates.");
    if (qty > left) return setError(`Only ${left} crates left on your allocation this week.`);
    setError("");
    start(async () => {
      const r = await placeOrder({ crates: qty, notes: notes.trim() });
      if (!r.ok) return setError(r.error);
      setCrates("");
      setNotes("");
      setDone(`Order for ${qty} crates placed — the farm will confirm it.`);
    });
  };

  return (
    <Card className="px-5 py-4">
      <CardTitle>Place an order</CardTitle>
      {blocked ? (
        <p className="mt-3 rounded-[10px] bg-[#fbeae7] p-3.5 text-[13.5px] text-[#8a2f22]">
          Ordering is paused until last week&apos;s balance is cleared.
        </p>
      ) : weeklyCrates === 0 ? (
        <p className="mt-3 rounded-[10px] bg-[#fcf2de] p-3.5 text-[13.5px] text-[#7a5410]">
          The farm hasn&apos;t set your weekly allocation yet. Call the farm office to start ordering.
        </p>
      ) : left === 0 ? (
        <p className="mt-3 rounded-[10px] bg-[#fcf2de] p-3.5 text-[13.5px] text-[#7a5410]">
          You&apos;ve used your full allocation of {weeklyCrates} crates this week. It resets on Monday.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-[13px] font-semibold text-[#4c5a51]">
              Crates
              <input
                type="number"
                min={1}
                max={left}
                required
                value={crates}
                onChange={(e) => setCrates(e.target.value)}
                placeholder={String(Math.min(left, 50))}
                className={`${inputCls} font-data w-28`}
              />
            </label>
            <label className="block min-w-[180px] grow text-[13px] font-semibold text-[#4c5a51]">
              Note (optional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Deliver to the Kaduna depot"
                maxLength={500}
                className={`${inputCls} w-full`}
              />
            </label>
            <button
              type="submit"
              disabled={placing}
              className="rounded-[10px] bg-[#2f8f46] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#27793b] disabled:opacity-50"
            >
              {placing ? "Placing…" : "Order"}
            </button>
          </div>
          <p className="text-[13px] text-[#647067]">
            {left} of {weeklyCrates} crates left this week
            {crates && Number(crates) > 0 && cratePrice > 0 ? (
              <>
                {" "}
                · Total <strong className="text-[#14231a]">{naira.format(Number(crates) * cratePrice)}</strong> at{" "}
                {naira.format(cratePrice)} a crate, locked in when you order
              </>
            ) : null}
          </p>
          {error ? <p className="text-[13px] text-[#c7402f]">{error}</p> : null}
          {done && !error ? <p className="text-[13px] text-[#23753a]">{done}</p> : null}
        </form>
      )}
    </Card>
  );
}

function OrderStatus({ o, weekStart }: { o: PortalOrder; weekStart: string }) {
  if (o.status === "declined") return <Pill label="Declined" tone="red" />;
  if (o.status === "pending") {
    return o.date < weekStart ? <Pill label="Expired" tone="gray" /> : <Pill label="Pending" tone="amber" />;
  }
  return o.deliveredAt ? <Pill label="Received" tone="green" /> : <Pill label="Fulfilled" tone="green" />;
}

export function OrdersTable({
  orders,
  weekStart,
  empty = "No orders yet — your first one will show up here.",
}: {
  orders: PortalOrder[];
  weekStart: string;
  empty?: string;
}) {
  const [confirming, start] = useTransition();
  const [error, setError] = useState("");
  const markReceived = (id: number) =>
    start(async () => {
      const r = await confirmReceived(id);
      setError(r.ok ? "" : r.error);
    });

  if (orders.length === 0) return <p className="px-5 pb-5 pt-2 text-[14px] text-[#647067]">{empty}</p>;
  return (
    <>
      <Table>
        <THead>
          <Th>Date</Th>
          <Th right>Crates</Th>
          <Th right>Price</Th>
          <Th right>Total</Th>
          <Th>Status</Th>
          <Th>Invoice</Th>
          <Th right />
        </THead>
        <tbody>
          {orders.map((o) => (
            <TRow key={o.id}>
              <Td>
                {shortDate(o.date)}
                {o.notes ? <span className="block text-[12px] text-[#8b958d]">{o.notes}</span> : null}
              </Td>
              <Td right className="font-semibold">
                {o.crates}
              </Td>
              <Td right className="text-[#647067]">
                {o.price ? naira.format(o.price) : "—"}
              </Td>
              <Td right>{o.price ? naira.format(o.price * o.crates) : "—"}</Td>
              <Td>
                <OrderStatus o={o} weekStart={weekStart} />
              </Td>
              <Td>
                {o.invoiceId ? (
                  <Link href={`/portal/invoices/${o.invoiceId}`} className="font-medium text-[#2f8f46] hover:underline">
                    {invNo(o.invoiceId)}
                  </Link>
                ) : (
                  <span className="text-[#8b958d]">—</span>
                )}
              </Td>
              <Td right>
                {o.status === "fulfilled" && !o.deliveredAt ? (
                  <button
                    onClick={() => markReceived(o.id)}
                    disabled={confirming}
                    className="rounded-[10px] border border-[#dce1da] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2f8f46] hover:border-[#2f8f46] disabled:opacity-50"
                  >
                    Mark received
                  </button>
                ) : null}
              </Td>
            </TRow>
          ))}
        </tbody>
      </Table>
      {error ? <p className="px-5 pb-4 text-[13px] text-[#c7402f]">{error}</p> : null}
    </>
  );
}

/** Opens Paystack's checkout for what's left on the invoice. */
function PayButton({ invoiceId }: { invoiceId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pay = async () => {
    setBusy(true);
    setError("");
    const r = await payInvoice(invoiceId);
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    window.location.href = r.url;
  };
  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={() => void pay()}
        disabled={busy}
        className="rounded-[10px] bg-[#2f8f46] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#27793b] disabled:opacity-50"
      >
        {busy ? "Opening…" : "Pay now"}
      </button>
      {error ? <span className="mt-1 max-w-[220px] whitespace-normal text-[11.5px] text-[#c7402f]">{error}</span> : null}
    </span>
  );
}

export function InvoicesTable({
  invoices,
  payOnline,
  weekStart,
  empty = "Invoices appear here once the farm fulfils an order.",
}: {
  invoices: PortalInvoice[];
  payOnline: boolean;
  weekStart: string;
  empty?: string;
}) {
  if (invoices.length === 0) return <p className="px-5 pb-5 pt-2 text-[14px] text-[#647067]">{empty}</p>;
  return (
    <Table>
      <THead>
        <Th>Invoice</Th>
        <Th>Date</Th>
        <Th>Item</Th>
        <Th right>Amount</Th>
        <Th right>Paid</Th>
        <Th right>Balance</Th>
        <Th>Status</Th>
        <Th right />
      </THead>
      <tbody>
        {invoices.map((v) => {
          const balance = v.amount - v.paid;
          const overdue = v.status === "pending" && v.date < weekStart;
          return (
            <TRow key={v.id}>
              <Td>
                <Link href={`/portal/invoices/${v.id}`} className="font-semibold text-[#14231a] hover:text-[#2f8f46] hover:underline">
                  {invNo(v.id)}
                </Link>
              </Td>
              <Td>{shortDate(v.date)}</Td>
              <Td className="text-[#4c5a51]">
                {v.qty} {v.unit === "crates" ? "crates" : v.unit} · {v.product}
              </Td>
              <Td right>{naira.format(v.amount)}</Td>
              <Td right className="text-[#647067]">
                {v.paid ? naira.format(v.paid) : "—"}
              </Td>
              <Td right className="font-semibold">
                {v.status === "paid" ? "—" : naira.format(balance)}
              </Td>
              <Td>
                {v.status === "paid" ? (
                  <Pill label="Paid" tone="green" />
                ) : overdue ? (
                  <Pill label="Overdue" tone="red" />
                ) : (
                  <Pill label={v.paid > 0 ? "Part-paid" : "Unpaid"} tone="amber" />
                )}
              </Td>
              <Td right>
                {v.status === "pending" && payOnline ? (
                  <PayButton invoiceId={v.id} />
                ) : (
                  <Link href={`/portal/invoices/${v.id}`} className="text-[12.5px] font-semibold text-[#2f8f46] hover:underline">
                    View
                  </Link>
                )}
              </Td>
            </TRow>
          );
        })}
      </tbody>
    </Table>
  );
}

export function PaymentsTable({ payments }: { payments: PortalPayment[] }) {
  if (payments.length === 0) {
    return <p className="px-5 pb-5 pt-2 text-[14px] text-[#647067]">No payments yet.</p>;
  }
  return (
    <Table>
      <THead>
        <Th>Date</Th>
        <Th>Invoice</Th>
        <Th>Method</Th>
        <Th>Reference</Th>
        <Th right>Amount</Th>
      </THead>
      <tbody>
        {payments.map((p) => (
          <TRow key={p.id}>
            <Td>{shortDate(p.date)}</Td>
            <Td>
              <Link href={`/portal/invoices/${p.invoiceId}`} className="font-medium text-[#2f8f46] hover:underline">
                {invNo(p.invoiceId)}
              </Link>
            </Td>
            <Td>{PAYMENT_METHOD[p.method]}</Td>
            <Td className="text-[#647067]">{p.reference || "—"}</Td>
            <Td right className="font-semibold">
              {naira.format(p.amount)}
            </Td>
          </TRow>
        ))}
      </tbody>
    </Table>
  );
}

export function CreditTable({ credits }: { credits: PortalCredit[] }) {
  return (
    <Table>
      <THead>
        <Th>Date</Th>
        <Th>What</Th>
        <Th right>Amount</Th>
      </THead>
      <tbody>
        {credits.map((c) => (
          <TRow key={c.id}>
            <Td>{shortDate(c.date)}</Td>
            <Td className="text-[#4c5a51]">{c.note}</Td>
            <Td right className={`font-semibold ${c.amount > 0 ? "text-[#23753a]" : "text-[#647067]"}`}>
              {c.amount > 0 ? "+" : "−"}
              {naira.format(Math.abs(c.amount))}
            </Td>
          </TRow>
        ))}
      </tbody>
    </Table>
  );
}

/** A card with a title row and an optional "see all" link. */
export function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <CardTitle>{title}</CardTitle>
        {link ? (
          <Link href={link.href} className="text-[13px] font-semibold text-[#2f8f46] hover:underline">
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
