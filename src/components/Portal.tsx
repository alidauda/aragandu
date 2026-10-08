"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { placeOrder } from "@/app/portal/actions";
import { authClient } from "@/lib/auth-client";
import {
  allocationLeft,
  blockingDebt,
  cratesOrderedInWeek,
  debtAmount,
  naira,
  type PortalInvoice,
  type PortalOrder,
} from "@/lib/orders";

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "amber" | "red" | "gray";
}) {
  const tones = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-700",
  } as const;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.refresh();
  };
}

/** Signed out: the farm issues every buyer login, so there's no sign-up. */
export function PortalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (error) {
      setError("Sign-in failed. Check your email and password.");
      setBusy(false);
      return;
    }
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-stone-900">Argandu Farms</h1>
        <p className="mt-1 text-sm text-stone-500">
          Buyer portal — sign in with the account the farm created for you.
        </p>

        <label className="mt-6 block text-sm font-medium text-stone-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            placeholder="you@business.com"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

/** Signed in, but not as a buyer (e.g. staff, or an unlinked login). */
export function NotABuyer() {
  const signOut = useSignOut();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-6 text-center">
      <p className="max-w-md text-stone-600">
        This portal is for verified buyers. Staff should sign in to the ERP at /login —
        ask the farm to set your account up as a buyer if that&apos;s wrong.
      </p>
      <button
        onClick={() => void signOut()}
        className="rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700"
      >
        Sign out
      </button>
    </main>
  );
}

export function BuyerDashboard({
  name,
  weeklyCrates,
  cratePrice,
  weekStart: thisWeek,
  orders,
  invoices,
}: {
  name: string;
  weeklyCrates: number;
  cratePrice: number;
  weekStart: string;
  orders: PortalOrder[];
  invoices: PortalInvoice[];
}) {
  const signOut = useSignOut();
  const [crates, setCrates] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, startPlacing] = useTransition();
  const [placeError, setPlaceError] = useState("");

  // The two business rules, derived on the spot from the ledgers.
  const ordered = cratesOrderedInWeek(orders, thisWeek);
  const left = allocationLeft(weeklyCrates, ordered);
  const blocking = blockingDebt(invoices, thisWeek);
  const owed = debtAmount(blocking);
  const blocked = blocking.length > 0;

  const submitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(crates);
    if (!Number.isInteger(qty) || qty <= 0) {
      setPlaceError("Enter a whole number of crates.");
      return;
    }
    if (qty > left) {
      setPlaceError(`Only ${left} crates left on your allocation this week.`);
      return;
    }
    setPlaceError("");
    startPlacing(async () => {
      const r = await placeOrder({ crates: qty, notes: notes.trim() });
      if (!r.ok) {
        setPlaceError(r.error);
        return;
      }
      setCrates("");
      setNotes("");
    });
  };

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Argandu Farms</h1>
            <p className="text-sm text-stone-500">{name}</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Headline: allocation + price + debt state */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              This week&apos;s allocation
            </p>
            <p className="mt-1 text-3xl font-bold text-stone-900">
              {left}
              <span className="text-base font-medium text-stone-400">
                {" "}
                / {weeklyCrates} crates
              </span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Week of {shortDate(thisWeek)} · {ordered} ordered
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Price per crate
            </p>
            <p className="mt-1 text-3xl font-bold text-stone-900">
              {cratePrice > 0 ? naira.format(cratePrice) : "—"}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Set by the farm; confirmed on your invoice
            </p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${
              blocked
                ? "border-red-200 bg-red-50"
                : "border-stone-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Account
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                blocked ? "text-red-700" : "text-green-700"
              }`}
            >
              {blocked ? naira.format(owed) : "Clear"}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {blocked
                ? `${blocking.length} unpaid invoice${blocking.length > 1 ? "s" : ""} from previous weeks`
                : "No outstanding balance from previous weeks"}
            </p>
          </div>
        </section>

        {/* Order form OR the debt wall */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-base font-bold text-stone-900">Place an order</h2>
          {blocked ? (
            <p className="mt-3 rounded-lg bg-red-50 p-4 text-sm text-red-800">
              Ordering is paused until last week&apos;s balance of{" "}
              <strong>{naira.format(owed)}</strong> is cleared. Once the farm
              marks your payment received, ordering reopens automatically.
            </p>
          ) : left === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              You&apos;ve used your full allocation of {weeklyCrates}{" "}
              crates for this week. It resets on Monday.
            </p>
          ) : (
            <form onSubmit={submitOrder} className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className="block text-sm font-medium text-stone-700">
                  Crates
                  <input
                    type="number"
                    min={1}
                    max={left}
                    required
                    value={crates}
                    onChange={(e) => setCrates(e.target.value)}
                    className="mt-1 block w-32 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                    placeholder={String(Math.min(left, 50))}
                  />
                </label>
                <label className="grow text-sm font-medium text-stone-700">
                  Note (optional)
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                    placeholder="Deliver to the Kaduna depot"
                  />
                </label>
                <button
                  type="submit"
                  disabled={placing}
                  className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {placing ? "Placing…" : "Order"}
                </button>
              </div>
              {crates && Number(crates) > 0 && cratePrice > 0 ? (
                <p className="text-sm text-stone-500">
                  Estimated total:{" "}
                  <strong className="text-stone-800">
                    {naira.format(Number(crates) * cratePrice)}
                  </strong>{" "}
                  — final price is confirmed on your invoice.
                </p>
              ) : null}
              {placeError ? (
                <p className="text-sm text-red-600">{placeError}</p>
              ) : null}
            </form>
          )}
        </section>

        {/* Order history */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-base font-bold text-stone-900">Your orders</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              No orders yet — your first one will show up here.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Crates</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-stone-100">
                    <td className="py-2.5 text-stone-800">{shortDate(o.date)}</td>
                    <td className="py-2.5 text-right text-stone-800">
                      {o.crates}
                    </td>
                    <td className="py-2.5 text-right">
                      {o.status === "pending" ? (
                        <Chip label="Pending" tone="amber" />
                      ) : o.status === "fulfilled" ? (
                        <Chip label="Fulfilled" tone="green" />
                      ) : (
                        <Chip label="Declined" tone="red" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Invoices */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-base font-bold text-stone-900">Your invoices</h2>
          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              Invoices appear here once the farm fulfils an order.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100">
                    <td className="py-2.5 text-stone-800">{shortDate(s.date)}</td>
                    <td className="py-2.5 text-stone-800">{s.product}</td>
                    <td className="py-2.5 text-right text-stone-800">
                      {s.qty}
                    </td>
                    <td className="py-2.5 text-right font-medium text-stone-800">
                      {naira.format(s.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      {s.status === "paid" ? (
                        <Chip label="Paid" tone="green" />
                      ) : (
                        <Chip label="Unpaid" tone="amber" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="pb-8 text-center text-xs text-stone-400">
          Payments are by bank transfer for now — the farm marks your invoice
          paid once received. Questions? Call the farm office.
        </p>
      </div>
    </main>
  );
}
