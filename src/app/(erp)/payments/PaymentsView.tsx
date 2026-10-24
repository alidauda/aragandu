"use client";

import Link from "next/link";
import { useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { fmtD, fmtN } from "@/lib/erp/derive";
import { PAYMENT_METHOD } from "@/lib/orders";
import { periodRange, type Period } from "@/lib/period";
import { LEDGER_KIND, type LedgerEntry, type LedgerKind, type OnlineAttempt } from "@/lib/ledger";
import type { ledgerTotals } from "@/lib/ledger";
import { PeriodPicker } from "@/components/erp/PeriodPicker";
import { Badge, Card, CardTitle, Kpi, Note, PageHeader, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

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
                  <Td>{fmtD(e.date)}</Td>
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
