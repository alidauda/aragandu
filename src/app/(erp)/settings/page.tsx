"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtN } from "@/lib/erp/derive";
import { Card, CardTitle, PageHeader } from "@/components/erp/ui";

const field =
  "w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";
const label = "mb-1.5 block text-[13px] font-semibold text-[#465657]";

/** Common Nigerian banks, as suggestions — any name can be typed. */
const BANKS = [
  "Access Bank",
  "Ecobank",
  "Fidelity Bank",
  "First Bank",
  "FCMB",
  "GTBank",
  "Keystone Bank",
  "Kuda",
  "Moniepoint",
  "OPay",
  "PalmPay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC",
  "Sterling Bank",
  "UBA",
  "Union Bank",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

/** The farm's settings: how buyers pay (and into which account), and the crate price. */
export default function Settings() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" sub="How buyers pay the farm, and the price of eggs" />
      <PaymentSettings />
      <EggSettings />
    </>
  );
}

function PaymentSettings() {
  const S = useErp();
  const [form, setForm] = useState({
    mode: S.paymentMode,
    bankName: S.bankName,
    accountName: S.accountName,
    accountNumber: S.accountNumber,
    note: S.paymentNote,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const manual = form.mode === "manual";
  const changed =
    form.mode !== S.paymentMode ||
    form.bankName !== S.bankName ||
    form.accountName !== S.accountName ||
    form.accountNumber !== S.accountNumber ||
    form.note !== S.paymentNote;

  const save = async () => {
    const digits = form.accountNumber.replace(/\s+/g, "");
    if (manual && !(form.bankName.trim() && form.accountName.trim() && digits)) {
      return setError("For manual payments, fill in the bank, the account name and the account number.");
    }
    if (digits && !/^\d{10}$/.test(digits)) return setError("The account number is 10 digits.");
    setError("");
    const r = await S.setPaymentSettings({ ...form, accountNumber: digits });
    if (!r.ok) return setError(r.error);
    setForm({ ...form, accountNumber: digits });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const option = (value: "online" | "manual", title: string, help: string) => (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
        form.mode === value ? "border-[#055a5b] bg-[#f3f8f7]" : "border-[#e4eaea]"
      }`}
    >
      <input
        type="radio"
        name="payment-mode"
        checked={form.mode === value}
        onChange={() => setForm({ ...form, mode: value })}
        className="mt-1 accent-[#055a5b]"
      />
      <span>
        <span className="block font-sub text-[14.5px] text-[#0d1d1d]">{title}</span>
        <span className="block text-[12.5px] text-[#5d6b6b]">{help}</span>
      </span>
    </label>
  );

  return (
    <Card className="mb-4 px-5 py-5">
      <CardTitle>Payments</CardTitle>
      <p className="mt-1 text-[13.5px] text-[#5d6b6b]">How buyers pay for their orders and invoices in the portal.</p>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {option(
          "online",
          "Online — Paystack",
          S.paystackReady
            ? "Buyers pay by card, transfer or USSD in the portal. Paystack takes the money and the payment records itself — nothing else to set up."
            : "Paystack's key (PAYSTACK_SECRET_KEY) isn't set on the server yet — until it is, buyers are shown manual payment."
        )}
        {option(
          "manual",
          "Manual — into the farm's account",
          "No online checkout. Buyers pay into the account below, upload the receipt, and staff mark it paid."
        )}
      </div>

      {manual ? (
        <div className="mt-5">
          <div className="font-sub text-[14.5px] text-[#0d1d1d]">Account buyers pay into</div>
          <div className="mt-2.5 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className={label}>Bank</span>
              <input
                list="banks"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="GTBank"
                className={field}
              />
              <datalist id="banks">
                {BANKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className={label}>Account name</span>
              <input
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                placeholder="Argandu Farms Ltd"
                className={field}
              />
            </label>
            <label className="block">
              <span className={label}>Account number</span>
              <input
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="0123456789"
                maxLength={13}
                className={`${field} font-figure tracking-wide`}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={label}>Anything else buyers should know (optional)</span>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              placeholder="Cash is also accepted at the farm gate, 8am–4pm."
              className={field}
            />
          </label>

          <div className="mt-4 rounded-xl border border-[#cfe3df] bg-[#f3f8f7] px-4 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#5d6b6b]">What buyers see</div>
            <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[14px]">
              <span className="text-[#5d6b6b]">Bank</span>
              <span className="font-semibold">{form.bankName || "—"}</span>
              <span className="text-[#5d6b6b]">Account name</span>
              <span className="font-semibold">{form.accountName || "—"}</span>
              <span className="text-[#5d6b6b]">Account number</span>
              <span className="font-figure font-semibold tracking-wide">{form.accountNumber || "—"}</span>
            </div>
            {form.note.trim() ? <p className="mt-1.5 whitespace-pre-line text-[13px] text-[#465657]">{form.note}</p> : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[13px] text-[#c7402f]">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={S.saving || !changed}
          className="rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        {saved ? <span className="text-[13px] font-semibold text-[#016559]">Saved ✓</span> : null}
      </div>
    </Card>
  );
}

function EggSettings() {
  const S = useErp();
  const [price, setPrice] = useState(S.cratePrice ? String(S.cratePrice) : "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const own = S.customers.filter((c) => c.price && !c.archived).length;

  const save = async () => {
    const n = Number(price);
    if (!(n > 0)) return setError("Enter a price above 0.");
    setError("");
    const r = await S.setCratePrice(n);
    if (!r.ok) return setError(r.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card className="px-5 py-5">
      <CardTitle>Eggs</CardTitle>
      <p className="mt-1 text-[13.5px] text-[#5d6b6b]">
        The farm&apos;s crate price for new orders and sales. Orders already placed keep their price
        {own ? `; ${own} buyer${own === 1 ? " has" : "s have"} their own price (Customers → Edit)` : ""}.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={label}>Price per crate (₦)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} w-48`} />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={S.saving || Number(price) === S.cratePrice}
          className="rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        {saved ? <span className="pb-2.5 text-[13px] font-semibold text-[#016559]">Saved ✓ — now {fmtN(S.cratePrice)}</span> : null}
      </div>
      {error ? <p className="mt-2 text-[13px] text-[#c7402f]">{error}</p> : null}
    </Card>
  );
}
