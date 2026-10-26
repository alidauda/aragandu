"use client";

import Link from "next/link";
import { useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { farmStamp } from "@/lib/dates";
import { fmtD, fmtN } from "@/lib/erp/derive";
import { PAYMENT_METHOD } from "@/lib/orders";
import { periodRange, type Period } from "@/lib/period";
import { LEDGER_KIND, type LedgerEntry, type LedgerKind, type OnlineAttempt } from "@/lib/ledger";
import type { ledgerTotals } from "@/lib/ledger";
import { useErp } from "@/lib/erp/store";
import { PeriodPicker } from "@/components/erp/PeriodPicker";
import { Badge, Card, CardTitle, Kpi, Note, PageHeader, Recorded, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

const KIND_TONE: Record<LedgerKind, { bg: string; fg: string }> = {
  invoice: { bg: "#e2f0ed", fg: "#016559" },
  order: { bg: "#e8f1fb", fg: "#2f6fb3" },
  advance: { bg: "#e8f1fb", fg: "#2f6fb3" },
  overpayment: { bg: "#fcf2de", fg: "#9a6a12" },
  refund: { bg: "#fbeae7", fg: "#c7402f" },
  "credit-used": { bg: "#ebf0ef", fg: "#5d6b6b" },
};

export function PaymentsView({
  today,
  period,
  entries,
  online,
  totals,
}: {
  today: string;
  period: Period;
  entries: LedgerEntry[];
  online: OnlineAttempt[];
  totals: ReturnType<typeof ledgerTotals>;
}) {
  const [method, setMethod] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const shown = entries.filter(
    (e) =>
      (!method || e.method === method) &&
      (!kind || e.kind === kind) &&
      (!q.trim() || `${e.buyer} ${e.reference} ${e.for}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  const exportCsv = () =>
    downloadCsv(
      `argandu-payments-${period.from}-to-${period.to}.csv`,
      shown.map((e) => ({
        date: e.date,
        buyer: e.buyer,
        type: LEDGER_KIND[e.kind],
        amount: e.amount,
        method: e.method ? PAYMENT_METHOD[e.method] : "",
        for: e.for,
        reference: e.reference,
        recorded_by: e.by,
        recorded_at: farmStamp(e.at),
      }))
    );

  const select = "rounded-lg border border-[#d6dfde] bg-white px-2.5 py-1.5 text-[13px]";

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        sub={`Every payment in and out — ${periodRange(period)}`}
        action={
          <button
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b] disabled:opacity-50"
          >
            Download CSV
          </button>
        }
      />
      <HowBuyersPay />
      <div className="mb-4">
        <PeriodPicker path="/payments" period={period} today={today} />
      </div>

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Received" value={fmtN(totals.received)} sub={`${entries.filter((e) => e.amount > 0 && e.kind !== "credit-used").length} payments`} color="#016559" />
        <Kpi label="Refunded" value={fmtN(totals.refunded)} sub="Paid back to buyers" color={totals.refunded ? "#c7402f" : "#0d1d1d"} />
        <Kpi label="Net in" value={fmtN(totals.net)} sub="Received − refunded" />
        <Kpi label="Credit used on invoices" value={fmtN(totals.creditUsed)} sub="Not new money — paid earlier" color="#5d6b6b" />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {totals.byMethod.map((m) => (
          <Card key={m.method} className="px-5 py-3.5">
            <div className="text-[13px] text-[#5d6b6b]">{m.label}</div>
            <div className="font-figure mt-0.5 text-[20px] font-bold text-[#0d1d1d]">{fmtN(m.amount)}</div>
            <div className="text-[12px] text-[#84908f]">
              {totals.received ? `${Math.round((100 * m.amount) / totals.received)}% of received` : "—"}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5">
          <CardTitle>All payments</CardTitle>
          <span className="ml-auto" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buyer, reference, invoice" className={`${select} w-[220px]`} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={select}>
            <option value="">All types</option>
            {Object.entries(LEDGER_KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={select}>
            <option value="">All methods</option>
            {(["transfer", "cash", "pos", "paystack", "credit"] as const).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Buyer</Th>
              <Th>Type</Th>
              <Th>For</Th>
              <Th>Method</Th>
              <Th>Reference</Th>
              <Th>By</Th>
              <Th right>Amount</Th>
            </THead>
            <tbody>
              {shown.length === 0 ? (
                <TRow>
                  <Td colSpan={8} className="text-[#84908f]">
                    No payments in this period{q || kind || method ? " match the filters" : ""}.
                  </Td>
                </TRow>
              ) : null}
              {shown.map((e) => (
                <TRow key={e.key}>
                  <Td>
                    {fmtD(e.date)}
                    <Recorded at={e.at} date={e.date} />
                  </Td>
                  <Td className="font-semibold">{e.buyer}</Td>
                  <Td>
                    <Badge label={LEDGER_KIND[e.kind]} bg={KIND_TONE[e.kind].bg} fg={KIND_TONE[e.kind].fg} />
                  </Td>
                  <Td>
                    {e.link ? (
                      <Link href={e.link} className="font-medium text-[#055a5b] hover:underline">
                        {e.for}
                      </Link>
                    ) : (
                      <span className="text-[#465657]">{e.for}</span>
                    )}
                  </Td>
                  <Td className="text-[#465657]">{e.method ? PAYMENT_METHOD[e.method] : "—"}</Td>
                  <Td className="!whitespace-normal max-w-[260px] text-[12.5px] text-[#5d6b6b]">{e.reference || "—"}</Td>
                  <Td className="text-[#465657]">{e.by}</Td>
                  <Td right className={`font-semibold ${e.kind === "credit-used" ? "text-[#84908f]" : e.amount < 0 ? "text-[#c7402f]" : ""}`}>
                    {e.amount < 0 ? "−" : ""}
                    {fmtN(Math.abs(e.amount))}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {online.length ? (
        <Card className="mt-4 overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>Online checkouts not completed</CardTitle>
          </div>
          <div className="mt-2">
            <Table>
              <THead>
                <Th>Started</Th>
                <Th>Buyer</Th>
                <Th>For</Th>
                <Th>Status</Th>
                <Th>Paystack reference</Th>
                <Th right>Amount</Th>
              </THead>
              <tbody>
                {online.map((o) => (
                  <TRow key={o.reference}>
                    <Td>{fmtD(o.at.slice(0, 10))}</Td>
                    <Td className="font-semibold">{o.buyer}</Td>
                    <Td>{o.for}</Td>
                    <Td>
                      <Badge label={o.status} bg="#fcf2de" fg="#9a6a12" />
                    </Td>
                    <Td className="font-data text-[12px] text-[#5d6b6b]">{o.reference}</Td>
                    <Td right>{fmtN(o.amount)}</Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      ) : null}
      <Note>
        Received counts money that came in: invoice payments, orders paid up front, advances and overpayments, by
        the day they arrived. Credit used is money paid earlier being spent on an invoice, so it isn&apos;t counted
        again. Checkouts not completed never reached the farm — no money moved.
      </Note>
    </>
  );
}

/**
 * Online (Paystack in the portal) or manual (paid outside the app — staff
 * mark orders and invoices paid). The owner and farm-wide admins switch it.
 */
function HowBuyersPay() {
  const S = useErp();
  const canChange = S.viewer.owner || S.grants.farm === "admin";
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState(S.paymentMode);
  const [note, setNote] = useState(S.paymentNote);
  const [error, setError] = useState("");
  const live = S.paymentMode === "online" && S.paystackReady;

  const save = async () => {
    setError("");
    const r = await S.setPaymentSettings({ mode, note });
    if (!r.ok) return setError(r.error);
    setEditing(false);
  };

  const option = (value: "online" | "manual", title: string, help: string) => (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
        mode === value ? "border-[#055a5b] bg-[#f3f8f7]" : "border-[#e4eaea]"
      }`}
    >
      <input
        type="radio"
        name="payment-mode"
        checked={mode === value}
        onChange={() => setMode(value)}
        className="mt-1 accent-[#055a5b]"
      />
      <span>
        <span className="block font-sub text-[14px] text-[#0d1d1d]">{title}</span>
        <span className="block text-[12.5px] text-[#5d6b6b]">{help}</span>
      </span>
    </label>
  );

  return (
    <Card className="mb-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>How buyers pay</CardTitle>
          <p className="mt-1 text-[13.5px] text-[#465657]">
            {live ? (
              <>
                <span className="font-semibold text-[#016559]">Online</span> — buyers pay in the portal with Paystack;
                payments record themselves.
              </>
            ) : S.paymentMode === "online" ? (
              <>
                <span className="font-semibold text-[#9a6a12]">Online, but Paystack isn&apos;t set up</span> — until its key
                is added, buyers pay outside the app and you mark them paid.
              </>
            ) : (
              <>
                <span className="font-semibold text-[#055a5b]">Manual</span> — buyers pay outside the app (transfer, cash,
                POS); mark orders paid on Egg orders and record invoice payments on Sales.
              </>
            )}
          </p>
        </div>
        {canChange && !editing ? (
          <button
            type="button"
            onClick={() => {
              setMode(S.paymentMode);
              setNote(S.paymentNote);
              setError("");
              setEditing(true);
            }}
            className="rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
          >
            Change
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3.5 flex flex-col gap-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {option(
              "online",
              "Online — Paystack",
              S.paystackReady
                ? "Buyers pay by card, transfer or USSD in the portal. Paid orders go straight to the queue."
                : "Needs PAYSTACK_SECRET_KEY on the server — until then it works like manual."
            )}
            {option(
              "manual",
              "Manual — outside the app",
              "No online checkout. Buyers pay you directly; you mark orders paid and record payments."
            )}
          </div>
          <label className="block">
            <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">
              How to pay — what buyers see {mode === "online" ? "(when paying outside the app)" : ""}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={"Bank: GTBank\nAccount name: Argandu Farms Ltd\nAccount number: 0123456789"}
              className="w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15"
            />
          </label>
          {error ? <p className="text-[13px] text-[#c7402f]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={S.saving}
              className="rounded-[10px] bg-[#055a5b] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#465657]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : S.paymentNote.trim() ? (
        <p className="mt-2 whitespace-pre-line rounded-[10px] bg-[#f4f6f5] px-3 py-2.5 text-[13px] text-[#465657]">
          {S.paymentNote.trim()}
        </p>
      ) : null}
    </Card>
  );
}
