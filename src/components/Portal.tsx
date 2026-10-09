"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { confirmReceived, placeOrder } from "@/app/portal/actions";
import { authClient } from "@/lib/auth-client";
import { changePassword } from "@/lib/change-password";
import {
  allocationLeft,
  blockingDebt,
  cratesOrderedInWeek,
  debtAmount,
  naira,
  type PortalInvoice,
  type PortalOrder,
} from "@/lib/orders";
import { Logo } from "@/components/Logo";

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
    green: "bg-[#e7f4ea] text-[#23753a]",
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
export function PortalLogin({ notice }: { notice?: string }) {
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
      setError(
        error.status === 429
          ? "Too many attempts. Wait a few seconds and try again."
          : error.status === 403
            ? "This account's access has been removed. Contact the farm."
            : "Sign-in failed. Check your email and password."
      );
      setBusy(false);
      return;
    }
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f3] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] rounded-2xl border border-[#e7ebe6] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(16,58,34,0.35)]"
      >
        <Logo caption="Buyer portal" />
        <h1 className="font-display mt-7 text-[26px] font-bold text-[#14231a]">Sign in</h1>
        <p className="mt-1 text-sm text-[#647067]">
          Use the account the farm created for you.
        </p>

        {notice ? (
          <p className="mt-4 rounded-[10px] bg-[#e7f4ea] px-3 py-2 text-sm text-[#23753a]">
            {notice}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-[#4c5a51]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
            placeholder="you@business.com"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#4c5a51]">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[10px] bg-[#2f8f46] px-4 py-2.5 font-semibold text-white transition hover:bg-[#27793b] disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

/** The buyer's own password change; other devices are signed out. */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const err = await changePassword(pw.current, pw.next, pw.confirm);
    setBusy(false);
    if (err) return setError(err);
    setDone(true);
  };

  const input =
    "mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14231a]/30 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#e7ebe6] bg-white p-6 shadow-lg"
      >
        <h2 className="text-base font-bold text-[#14231a]">Change password</h2>
        {done ? (
          <p className="mt-3 text-sm text-[#23753a]">Password changed.</p>
        ) : (
          <>
            {(
              [
                ["current", "Current password"],
                ["next", "New password (8+ characters)"],
                ["confirm", "Confirm new password"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mt-4 block text-sm font-medium text-[#4c5a51]">
                {label}
                <input
                  type="password"
                  required
                  autoComplete={key === "current" ? "current-password" : "new-password"}
                  value={pw[key]}
                  onChange={(e) => setPw({ ...pw, [key]: e.target.value })}
                  className={input}
                />
              </label>
            ))}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-[10px] border border-[#dce1da] px-4 py-2 font-semibold text-[#4c5a51]"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {done ? null : (
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-[10px] bg-[#2f8f46] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Change"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Signed in, but not as a buyer (e.g. staff, or an unlinked login). */
export function NotABuyer() {
  const signOut = useSignOut();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f6f3] p-6 text-center">
      <p className="max-w-md text-[#647067]">
        This portal is for verified buyers. Staff should sign in to the ERP at /login —
        ask the farm to set your account up as a buyer if that&apos;s wrong.
      </p>
      <button
        onClick={() => void signOut()}
        className="rounded-[10px] border border-[#dce1da] px-4 py-2 font-semibold text-[#4c5a51]"
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
  credit,
  weekStart: thisWeek,
  orders,
  invoices,
}: {
  name: string;
  weeklyCrates: number;
  cratePrice: number;
  credit: number;
  weekStart: string;
  orders: PortalOrder[];
  invoices: PortalInvoice[];
}) {
  const signOut = useSignOut();
  const [pwOpen, setPwOpen] = useState(false);
  const [crates, setCrates] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, startPlacing] = useTransition();
  const [placeError, setPlaceError] = useState("");
  const [confirming, startConfirming] = useTransition();
  const [confirmError, setConfirmError] = useState("");

  const markReceived = (id: number) =>
    startConfirming(async () => {
      const r = await confirmReceived(id);
      setConfirmError(r.ok ? "" : r.error);
    });

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
    <main className="min-h-screen bg-[#f4f6f3]">
      <header className="border-b border-[#e7ebe6] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden h-8 w-px bg-[#e7ebe6] sm:block" />
            <p className="hidden text-[14.5px] font-semibold text-[#14231a] sm:block">{name}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPwOpen(true)}
              className="text-sm font-semibold text-[#647067] hover:text-[#14231a]"
            >
              Change password
            </button>
            <button
              onClick={() => void signOut()}
              className="text-sm font-semibold text-[#647067] hover:text-[#14231a]"
            >
              Sign out
            </button>
          </div>
        </div>
        {pwOpen ? <PasswordDialog onClose={() => setPwOpen(false)} /> : null}
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight text-[#14231a] md:text-[32px]">
            Order eggs
          </h1>
          <p className="mt-1 text-[14.5px] text-[#647067]">
            Your weekly allocation, the farm&apos;s price and your account in one place.
          </p>
        </div>
        {/* Headline: allocation + price + debt state */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e7ebe6] bg-white p-5">
            <p className="text-[13.5px] font-medium text-[#4c5a51]">
              This week&apos;s allocation
            </p>
            <p className="mt-1 text-3xl font-bold text-[#14231a]">
              {left}
              <span className="text-base font-medium text-[#8b958d]">
                {" "}
                / {weeklyCrates} crates
              </span>
            </p>
            <p className="mt-1 text-xs text-[#647067]">
              Week of {shortDate(thisWeek)} · {ordered} ordered
            </p>
          </div>
          <div className="rounded-2xl border border-[#e7ebe6] bg-white p-5">
            <p className="text-[13.5px] font-medium text-[#4c5a51]">
              Price per crate
            </p>
            <p className="mt-1 text-3xl font-bold text-[#14231a]">
              {cratePrice > 0 ? naira.format(cratePrice) : "—"}
            </p>
            <p className="mt-1 text-xs text-[#647067]">
              Set by the farm; locked in when you order
            </p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${
              blocked
                ? "border-red-200 bg-red-50"
                : "border-[#e7ebe6] bg-white"
            }`}
          >
            <p className="text-[13.5px] font-medium text-[#4c5a51]">
              Account
            </p>
            <p
              className={`mt-1 text-3xl font-bold ${
                blocked ? "text-red-700" : "text-[#23753a]"
              }`}
            >
              {blocked ? naira.format(owed) : "Clear"}
            </p>
            <p className="mt-1 text-xs text-[#647067]">
              {blocked
                ? `${blocking.length} unpaid invoice${blocking.length > 1 ? "s" : ""} from previous weeks`
                : "No outstanding balance from previous weeks"}
            </p>
            {credit > 0 ? (
              <p className="mt-1 text-xs font-semibold text-[#23753a]">
                {naira.format(credit)} credit — used on your next invoice
              </p>
            ) : null}
          </div>
        </section>

        {/* Order form OR the debt wall */}
        <section className="rounded-2xl border border-[#e7ebe6] bg-white p-6">
          <h2 className="text-base font-bold text-[#14231a]">Place an order</h2>
          {blocked ? (
            <p className="mt-3 rounded-[10px] bg-red-50 p-4 text-sm text-red-800">
              Ordering is paused until last week&apos;s balance of{" "}
              <strong>{naira.format(owed)}</strong> is cleared. Once the farm
              marks your payment received, ordering reopens automatically.
            </p>
          ) : left === 0 ? (
            <p className="mt-3 rounded-[10px] bg-amber-50 p-4 text-sm text-amber-800">
              You&apos;ve used your full allocation of {weeklyCrates}{" "}
              crates for this week. It resets on Monday.
            </p>
          ) : (
            <form onSubmit={submitOrder} className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className="block text-sm font-medium text-[#4c5a51]">
                  Crates
                  <input
                    type="number"
                    min={1}
                    max={left}
                    required
                    value={crates}
                    onChange={(e) => setCrates(e.target.value)}
                    className="mt-1 block w-32 rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
                    placeholder={String(Math.min(left, 50))}
                  />
                </label>
                <label className="grow text-sm font-medium text-[#4c5a51]">
                  Note (optional)
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
                    placeholder="Deliver to the Kaduna depot"
                    maxLength={500}
                  />
                </label>
                <button
                  type="submit"
                  disabled={placing}
                  className="rounded-[10px] bg-[#2f8f46] px-5 py-2.5 font-semibold text-white transition hover:bg-[#27793b] disabled:opacity-50"
                >
                  {placing ? "Placing…" : "Order"}
                </button>
              </div>
              {crates && Number(crates) > 0 && cratePrice > 0 ? (
                <p className="text-sm text-[#647067]">
                  Estimated total:{" "}
                  <strong className="text-[#14231a]">
                    {naira.format(Number(crates) * cratePrice)}
                  </strong>{" "}
                  — this price is locked in when you order.
                </p>
              ) : null}
              {placeError ? (
                <p className="text-sm text-red-600">{placeError}</p>
              ) : null}
            </form>
          )}
        </section>

        {/* Order history */}
        <section className="rounded-2xl border border-[#e7ebe6] bg-white p-6">
          <h2 className="text-base font-bold text-[#14231a]">Your orders</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-[#647067]">
              No orders yet — your first one will show up here.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[#e7ebe6] text-left text-[12.5px] font-semibold text-[#7a857d]">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Crates</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-[#eef1ec]">
                    <td className="py-2.5 text-[#14231a]">
                      {shortDate(o.date)}
                      {o.notes ? (
                        <span className="block text-xs text-[#647067]">{o.notes}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right text-[#14231a]">
                      {o.crates}
                    </td>
                    <td className="py-2.5 text-right text-[#647067]">
                      {o.price ? naira.format(o.price) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {o.status === "pending" ? (
                        o.date < thisWeek ? (
                          <Chip label="Expired" tone="gray" />
                        ) : (
                          <Chip label="Pending" tone="amber" />
                        )
                      ) : o.status === "fulfilled" ? (
                        o.deliveredAt ? (
                          <Chip label="Received" tone="green" />
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Chip label="Fulfilled" tone="green" />
                            <button
                              onClick={() => markReceived(o.id)}
                              disabled={confirming}
                              className="rounded-lg border border-[#dce1da] px-2 py-0.5 text-xs font-semibold text-[#2f8f46] disabled:opacity-50"
                            >
                              Mark received
                            </button>
                          </span>
                        )
                      ) : (
                        <Chip label="Declined" tone="red" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {confirmError ? <p className="mt-3 text-sm text-red-600">{confirmError}</p> : null}
          {orders.some((o) => o.status === "pending" && o.date < thisWeek) ? (
            <p className="mt-3 text-xs text-[#647067]">
              An order not filled in its week expires — order again from this week&apos;s allocation.
            </p>
          ) : null}
        </section>

        {/* Invoices */}
        <section className="rounded-2xl border border-[#e7ebe6] bg-white p-6">
          <h2 className="text-base font-bold text-[#14231a]">Your invoices</h2>
          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-[#647067]">
              Invoices appear here once the farm fulfils an order.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[#e7ebe6] text-left text-[12.5px] font-semibold text-[#7a857d]">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((s) => (
                  <tr key={s.id} className="border-b border-[#eef1ec]">
                    <td className="py-2.5 text-[#14231a]">{shortDate(s.date)}</td>
                    <td className="py-2.5 text-[#14231a]">{s.product}</td>
                    <td className="py-2.5 text-right text-[#14231a]">
                      {s.qty}
                    </td>
                    <td className="py-2.5 text-right font-medium text-[#14231a]">
                      <a href={`/portal/invoices/${s.id}`} className="underline decoration-[#cfd6cf]">
                        {naira.format(s.amount)}
                      </a>
                    </td>
                    <td className="py-2.5 text-right text-[#14231a]">
                      {s.status === "paid" ? "—" : naira.format(s.amount - s.paid)}
                    </td>
                    <td className="py-2.5 text-right">
                      {s.status === "paid" ? (
                        <Chip label="Paid" tone="green" />
                      ) : s.paid > 0 ? (
                        <Chip label="Part-paid" tone="amber" />
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

        <p className="pb-8 text-center text-xs text-[#8b958d]">
          Payments are by bank transfer for now — the farm marks your invoice
          paid once received. Anything paid over an invoice is kept as credit
          for your next one. Questions? Call the farm office.
        </p>
      </div>
    </main>
  );
}
