"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Egg, ReceiptText, Wallet } from "lucide-react";

import { cancelOrder, confirmReceived, payInvoice, payOrder, placeOrder } from "@/app/portal/actions";
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
import { Drawer, FormError } from "@/components/erp/Drawer";
import { Badge, Card, CardTitle, ForestTile, Kpi, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

/** The pieces the buyer's Dashboard, Orders and Payments pages share. */


const TONES = {
  green: { bg: "#e2f0ed", fg: "#016559" },
  amber: { bg: "#fcf2de", fg: "#9a6a12" },
  red: { bg: "#fbeae7", fg: "#c7402f" },
  gray: { bg: "#ebf0ef", fg: "#5d6b6b" },
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
      ? "bg-[#e2f0ed] text-[#016559]"
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

/** This week's allocation as a bar: already ordered, this order, what's left. */
export function AllocationBar({ weekly, used, adding = 0 }: { weekly: number; used: number; adding?: number }) {
  const pct = (n: number) => (weekly ? `${Math.min(100, (n / weekly) * 100)}%` : "0%");
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#ebf0ef]">
        <div className="bg-[#8eb0b0]" style={{ width: pct(used) }} />
        <div className="bg-[#055a5b] transition-[width] duration-200" style={{ width: pct(adding) }} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12.5px] text-[#5d6b6b]">
        <span>
          {used} ordered{adding ? ` + ${adding} now` : ""} of {weekly}
        </span>
        <span className="font-semibold text-[#0d1d1d]">{Math.max(0, weekly - used - adding)} left this week</span>
      </div>
    </div>
  );
}

/** Why a buyer can't order right now, or null if they can. */
function cannotOrder(p: { blocked: boolean; weeklyCrates: number; left: number }) {
  if (p.blocked) return "Ordering is paused until last week's balance is paid.";
  if (p.weeklyCrates === 0) return "The farm hasn't set your weekly allocation yet — call the farm office.";
  if (p.left === 0) return "You've used this week's allocation. It resets on Monday.";
  return null;
}

/** What the farm sells through the portal. Eggs only, for now. */
const PRODUCTS = [{ id: "eggs", name: "Eggs", unit: "crate" }] as const;

const stepBtn =
  "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#d6dfde] bg-white text-[20px] font-semibold text-[#0d1d1d] hover:border-[#055a5b] disabled:opacity-40";

/**
 * "New order": pick the product, then the quantity — the stepper and slider
 * only go as far as this week's allocation allows. The server re-checks
 * allocation and debt when it's placed.
 */
export function NewOrderButton({
  left,
  used,
  weeklyCrates,
  cratePrice,
  eggsPerCrate,
  blocked,
  weekStart,
  freeCredit,
  payOnline,
}: {
  left: number;
  used: number;
  weeklyCrates: number;
  cratePrice: number;
  eggsPerCrate: number;
  blocked: boolean;
  weekStart: string;
  /** Credit not already holding a paid order — used first. */
  freeCredit: number;
  payOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<string>(PRODUCTS[0].id);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [placing, start] = useTransition();
  const reason = cannotOrder({ blocked, weeklyCrates, left });

  const begin = () => {
    setQty(Math.min(left, Math.max(1, Math.round(left / 2))));
    setNotes("");
    setError("");
    setDone("");
    setOpen(true);
  };
  const set = (n: number) => setQty(Math.max(1, Math.min(left, Math.round(n) || 1)));

  // Pay first: credit is used, then the rest is paid now.
  const total = qty * cratePrice;
  const fromCredit = Math.min(Math.max(0, freeCredit), total);
  const toPay = total - fromCredit;

  const submit = () =>
    start(async () => {
      if (qty < 1 || qty > left) return setError(`Choose between 1 and ${left} crates.`);
      const r = await placeOrder({ crates: qty, notes: notes.trim() });
      if (!r.ok) return setError(r.error);
      // Off to Paystack to pay; it brings the buyer back to Orders.
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setOpen(false);
      setDone(
        r.paid
          ? `Paid from your credit — your ${qty} crates are with the farm now.`
          : (r.notice ??
              `Order saved — pay ${naira.format(r.due)} by bank transfer within 24 hours and the farm will confirm it.`)
      );
    });

  // Quick picks: a quarter, half and all of what's left (distinct, at least 1).
  const picks = [...new Set([Math.ceil(left / 4), Math.ceil(left / 2), left])].filter((n) => n >= 1);

  return (
    <>
      <span className="inline-flex flex-col items-end gap-1">
        <button
          onClick={begin}
          disabled={reason !== null}
          title={reason ?? undefined}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#044647] disabled:cursor-not-allowed disabled:bg-[#8eb0b0]"
        >
          <span className="text-[17px] leading-none">+</span> New order
        </button>
        {done ? <span className="text-[12.5px] text-[#016559]">{done}</span> : null}
      </span>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New order"
        sub={`Week of ${shortDate(weekStart)} · price locked in when you order`}
        onSubmit={submit}
        submitLabel={
          toPay === 0 ? "Order — paid from credit" : payOnline ? `Pay ${naira.format(toPay)}` : `Order ${qty} crates`
        }
        busy={placing}
      >
        <div>
          <div className="mb-2 text-[13px] font-semibold text-[#465657]">What would you like?</div>
          <div className="grid gap-2">
            {PRODUCTS.map((p) => {
              const on = product === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProduct(p.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    on ? "border-[#055a5b] bg-[#edf5f4] ring-2 ring-[#055a5b]/15" : "border-[#e4eaea] hover:border-[#ccd7d6]"
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fcf2de] text-[#b07a1a]">
                    <Egg size={22} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#0d1d1d]">{p.name}</span>
                    <span className="block text-[12.5px] text-[#5d6b6b]">
                      Sold by the {p.unit} · {eggsPerCrate} eggs a {p.unit}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-data block text-[15px] font-bold text-[#0d1d1d]">
                      {cratePrice > 0 ? naira.format(cratePrice) : "—"}
                    </span>
                    <span className="block text-[11.5px] text-[#84908f]">per {p.unit}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-[#465657]">How many crates?</span>
            <span className="text-[12.5px] text-[#84908f]">up to {left} this week</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => set(qty - 1)} disabled={qty <= 1} className={stepBtn} aria-label="One less">
              −
            </button>
            <input
              type="number"
              min={1}
              max={left}
              value={qty}
              onChange={(e) => set(Number(e.target.value))}
              className="font-data h-11 min-w-0 flex-1 rounded-[10px] border border-[#d6dfde] text-center text-[20px] font-bold text-[#0d1d1d] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15"
            />
            <button type="button" onClick={() => set(qty + 1)} disabled={qty >= left} className={stepBtn} aria-label="One more">
              +
            </button>
          </div>
          {left > 1 ? (
            <input
              type="range"
              min={1}
              max={left}
              value={qty}
              onChange={(e) => set(Number(e.target.value))}
              className="mt-3 w-full accent-[#055a5b]"
              aria-label="Crates"
            />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {picks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set(n)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                  qty === n ? "border-[#055a5b] bg-[#e3efee] text-[#044647]" : "border-[#d6dfde] text-[#465657] hover:border-[#055a5b]"
                }`}
              >
                {n === left ? `All ${n}` : n}
              </button>
            ))}
          </div>
        </div>

        <AllocationBar weekly={weeklyCrates} used={used} adding={qty} />

        <div className="rounded-2xl bg-[#f2f6f5] px-4 py-3">
          <div className="flex justify-between text-[13.5px] text-[#465657]">
            <span>
              {qty} crate{qty > 1 ? "s" : ""} × {cratePrice > 0 ? naira.format(cratePrice) : "—"}
            </span>
            <span>{qty * eggsPerCrate} eggs</span>
          </div>
          {fromCredit > 0 ? (
            <>
              <div className="mt-1 flex justify-between text-[13.5px] text-[#465657]">
                <span>Total</span>
                <span>{naira.format(total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-[13.5px] text-[#016559]">
                <span>From your credit</span>
                <span>− {naira.format(fromCredit)}</span>
              </div>
            </>
          ) : null}
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[13.5px] font-semibold text-[#0d1d1d]">{fromCredit > 0 ? "To pay now" : "Total to pay now"}</span>
            <span className="font-figure text-[22px] font-bold text-[#0d1d1d]">
              {cratePrice > 0 ? naira.format(toPay) : "—"}
            </span>
          </div>
        </div>
        <p className="-mt-1 text-[12.5px] text-[#5d6b6b]">
          {toPay === 0
            ? "Your credit covers it — the order goes straight to the farm."
            : payOnline
              ? "You pay now on Paystack (card, transfer or USSD). Your order goes to the farm once it's paid; if they can't supply it all, the rest stays as your credit."
              : "Pay by bank transfer within 24 hours — the farm confirms it and your order goes through. Unpaid orders are released."}
        </p>

        <label className="block">
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Note for the farm (optional)</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Deliver to the Kaduna depot"
            maxLength={500}
            className="w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] text-[#0d1d1d] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15"
          />
        </label>
        <FormError message={error} />
      </Drawer>
    </>
  );
}

/** The dashboard's order card: this week's allocation and the New order button. */
export function OrderCard(props: Parameters<typeof NewOrderButton>[0]) {
  const reason = cannotOrder(props);
  return (
    <Card className="flex flex-col px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Place an order</CardTitle>
        <NewOrderButton {...props} />
      </div>
      <div className="mt-4">
        <AllocationBar weekly={props.weeklyCrates} used={props.used} />
      </div>
      <p className={`mt-3 text-[13px] ${reason ? "text-[#9a6a12]" : "text-[#5d6b6b]"}`}>
        {reason ?? "Your allocation resets every Monday. Pick how many crates and the price is locked in."}
      </p>
    </Card>
  );
}

const holdUntil = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit" });

function OrderStatus({ o }: { o: PortalOrder }) {
  if (o.status === "declined") {
    const why = o.declineReason ?? "";
    return (
      <span className="inline-flex flex-col gap-1">
        {why === "Not paid in time" ? (
          <Pill label="Released — not paid" tone="gray" />
        ) : why.startsWith("Cancelled") ? (
          <Pill label="Cancelled" tone="gray" />
        ) : why === "Expired" ? (
          <Pill label="Expired" tone="gray" />
        ) : (
          <Pill label="Not fulfilled" tone="red" />
        )}
        {o.paidAt ? <span className="text-[11.5px] text-[#016559]">Payment kept as your credit</span> : null}
      </span>
    );
  }
  if (o.status === "pending") {
    return o.paidAt ? (
      <Pill label="Paid · with the farm" tone="green" />
    ) : (
      <span className="inline-flex flex-col gap-1">
        <Pill label="Awaiting payment" tone="amber" />
        {o.payBy ? <span className="text-[11.5px] text-[#84908f]">held until {holdUntil(o.payBy)}</span> : null}
      </span>
    );
  }
  return o.deliveredAt ? <Pill label="Received" tone="green" /> : <Pill label="On its way" tone="green" />;
}

export function OrdersTable({
  orders,
  payOnline,
  empty = "No orders yet — your first one will show up here.",
}: {
  orders: PortalOrder[];
  payOnline: boolean;
  empty?: string;
}) {
  const [confirming, start] = useTransition();
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<number | null>(null);
  const markReceived = (id: number) =>
    start(async () => {
      const r = await confirmReceived(id);
      setError(r.ok ? "" : r.error);
    });
  const cancel = (id: number) => {
    if (!window.confirm("Cancel this unpaid order? Its crates go back on your allocation.")) return;
    start(async () => {
      const r = await cancelOrder(id);
      setError(r.ok ? "" : r.error);
    });
  };
  const pay = async (id: number) => {
    setPaying(id);
    setError("");
    const r = await payOrder(id);
    if (!r.ok) {
      setPaying(null);
      return setError(r.error);
    }
    if (r.url) {
      window.location.href = r.url;
      return;
    }
    setPaying(null);
  };

  if (orders.length === 0) return <p className="px-5 pb-5 pt-2 text-[14px] text-[#5d6b6b]">{empty}</p>;
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
                {o.notes ? <span className="block text-[12px] text-[#84908f]">{o.notes}</span> : null}
              </Td>
              <Td right className="font-semibold">
                {o.crates}
              </Td>
              <Td right className="text-[#5d6b6b]">
                {o.price ? naira.format(o.price) : "—"}
              </Td>
              <Td right>{o.price ? naira.format(o.price * o.crates) : "—"}</Td>
              <Td>
                <OrderStatus o={o} />
              </Td>
              <Td>
                {o.invoiceId ? (
                  <Link href={`/portal/invoices/${o.invoiceId}`} className="font-medium text-[#055a5b] hover:underline">
                    {invNo(o.invoiceId)}
                  </Link>
                ) : (
                  <span className="text-[#84908f]">—</span>
                )}
              </Td>
              <Td right>
                {o.status === "pending" && !o.paidAt ? (
                  <span className="inline-flex gap-2">
                    {payOnline ? (
                      <button
                        onClick={() => void pay(o.id)}
                        disabled={paying !== null || confirming}
                        className="rounded-[10px] bg-[#055a5b] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#044647] disabled:opacity-50"
                      >
                        {paying === o.id ? "Opening…" : "Pay now"}
                      </button>
                    ) : null}
                    <button
                      onClick={() => cancel(o.id)}
                      disabled={paying !== null || confirming}
                      className="rounded-[10px] border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </span>
                ) : o.status === "fulfilled" && !o.deliveredAt ? (
                  <button
                    onClick={() => markReceived(o.id)}
                    disabled={confirming}
                    className="rounded-[10px] border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b] hover:border-[#055a5b] disabled:opacity-50"
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
        className="rounded-[10px] bg-[#055a5b] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#044647] disabled:opacity-50"
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
  if (invoices.length === 0) return <p className="px-5 pb-5 pt-2 text-[14px] text-[#5d6b6b]">{empty}</p>;
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
                <Link href={`/portal/invoices/${v.id}`} className="font-semibold text-[#0d1d1d] hover:text-[#055a5b] hover:underline">
                  {invNo(v.id)}
                </Link>
              </Td>
              <Td>{shortDate(v.date)}</Td>
              <Td className="text-[#465657]">
                {v.qty} {v.unit === "crates" ? "crates" : v.unit} · {v.product}
              </Td>
              <Td right>{naira.format(v.amount)}</Td>
              <Td right className="text-[#5d6b6b]">
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
                  <Link href={`/portal/invoices/${v.id}`} className="text-[12.5px] font-semibold text-[#055a5b] hover:underline">
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
    return <p className="px-5 pb-5 pt-2 text-[14px] text-[#5d6b6b]">No payments yet.</p>;
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
              <Link href={`/portal/invoices/${p.invoiceId}`} className="font-medium text-[#055a5b] hover:underline">
                {invNo(p.invoiceId)}
              </Link>
            </Td>
            <Td>{PAYMENT_METHOD[p.method]}</Td>
            <Td className="text-[#5d6b6b]">{p.reference || "—"}</Td>
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
            <Td className="text-[#465657]">{c.note}</Td>
            <Td right className={`font-semibold ${c.amount > 0 ? "text-[#016559]" : "text-[#5d6b6b]"}`}>
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
          <Link href={link.href} className="text-[13px] font-semibold text-[#055a5b] hover:underline">
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
