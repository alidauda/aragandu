"use client";

import { useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { monthName } from "@/lib/dates";
import { activeBirds, balance, fmtK, fmtN, runPositions } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, CardTitle, Kpi, Note, PageHeader, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

const METHOD = { transfer: "Bank transfer", cash: "Cash", pos: "POS" } as const;

/** The last 12 months, newest first, as YYYY-MM. */
function recentMonths(today: string) {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

function Section({
  title,
  onCsv,
  children,
}: {
  title: string;
  onCsv?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-4 px-5 py-4">
      <div className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {onCsv ? (
          <button
            onClick={onCsv}
            className="rounded-lg border border-[#cfd3bd] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#3c4d28]"
          >
            Download CSV
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export default function Reports() {
  const S = useErp();
  const months = recentMonths(S.today);
  const [month, setMonth] = useState(months[0]);
  const inMonth = (date: string) => date.startsWith(month);
  const label = `${monthName(`${month}-01`)} ${month.slice(0, 4)}`;
  const file = (name: string) => `argandu-${name}-${month}.csv`;
  const product = (id: number) => S.products.find((p) => p.id === id)?.name ?? "";
  const ingredient = (id: number) => S.ingredients.find((i) => i.id === id)?.name ?? "";

  // ── Sales & money
  const invoices = S.invoices.filter((v) => inMonth(v.date));
  const eggInvoices = invoices.filter((v) => v.product.startsWith("Eggs"));
  const invoiced = invoices.reduce((a, v) => a + v.qty * v.price, 0);
  const payments = S.payments.filter((p) => inMonth(p.date));
  const collected = payments.reduce((a, p) => a + p.amount, 0);
  const byMethod = (["transfer", "cash", "pos"] as const).map((m) => ({
    method: METHOD[m],
    amount: payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0),
  }));

  // ── Eggs
  const prod = S.prodLog.filter((p) => inMonth(p.date));
  const eggs = prod.reduce((a, p) => a + p.eggs, 0);
  const cracked = prod.reduce((a, p) => a + p.cracked, 0);
  const rejects = prod.reduce((a, p) => a + p.rejects, 0);
  const days = new Set(prod.map((p) => p.date)).size;
  const birds = activeBirds(S.batches);

  // ── Feed mill
  const runs = runPositions(S.runs, S.products).filter((r) => inMonth(r.date));
  const producedKg = runs.reduce((a, r) => a + r.output, 0);
  const runCost = runs.reduce((a, r) => a + r.cost, 0);
  const feedSales = S.feedSales.filter((s) => inMonth(s.date));
  const deliveries = S.deliveries.filter((d) => inMonth(d.date));

  // ── Debtors (as of today, not just this month)
  const debtors = S.customers
    .map((c) => {
      const open = S.invoices.filter((v) => v.cust === c.id && v.status === "pending");
      return {
        name: c.name,
        phone: c.phone,
        invoices: open.length,
        owed: open.reduce((a, v) => a + balance(v), 0),
        oldest: open.map((v) => v.date).sort()[0] ?? "",
      };
    })
    .filter((d) => d.owed > 0)
    .sort((a, b) => b.owed - a.owed);

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Reports"
        sub="Monthly figures and exports — CSV opens in Excel or Google Sheets"
        action={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[#cfd3bd] bg-white px-3 py-1.5 text-[13px]"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(`${m}-01`)} {m.slice(0, 4)}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label={`Invoiced — ${label}`} value={fmtN(invoiced)} sub={`${invoices.length} invoices`} />
        <Kpi label="Collected" value={fmtN(collected)} sub={`${payments.length} payments`} color="#3f6f3a" />
        <Kpi label="Eggs collected" value={fmtK(eggs)} sub={`${days} days logged`} color="#2f7cb6" />
        <Kpi label="Feed produced" value={`${fmtK(producedKg)} kg`} sub={`${runs.length} runs`} />
      </div>

      <Section
        title={`Sales — ${label}`}
        onCsv={() =>
          downloadCsv(
            file("sales"),
            invoices.map((v) => ({
              invoice: `INV-${String(v.id).padStart(5, "0")}`,
              date: v.date,
              buyer: v.name,
              product: v.product,
              qty: v.qty,
              unit: v.unit ?? "crates",
              unit_price: v.price,
              amount: v.qty * v.price,
              paid: v.paid,
              balance: balance(v),
              status: v.status,
            }))
          )
        }
      >
        <div className="grid grid-cols-2 gap-3 text-[13px] lg:grid-cols-4">
          <div>Egg crates sold: <b>{fmtK(eggInvoices.reduce((a, v) => a + v.qty, 0))}</b></div>
          <div>Egg revenue: <b>{fmtN(eggInvoices.reduce((a, v) => a + v.qty * v.price, 0))}</b></div>
          <div>Other sales: <b>{fmtN(invoiced - eggInvoices.reduce((a, v) => a + v.qty * v.price, 0))}</b></div>
          <div>Unpaid from this month: <b>{fmtN(invoices.filter((v) => v.status === "pending").reduce((a, v) => a + balance(v), 0))}</b></div>
        </div>
      </Section>

      <Section
        title={`Money in — ${label}`}
        onCsv={() =>
          downloadCsv(
            file("payments"),
            payments.map((p) => {
              const v = S.invoices.find((x) => x.id === p.invoiceId);
              return {
                date: p.date,
                invoice: `INV-${String(p.invoiceId).padStart(5, "0")}`,
                buyer: v?.name ?? "",
                amount: p.amount,
                method: METHOD[p.method],
                reference: p.reference,
                recorded_by: p.by,
              };
            })
          )
        }
      >
        <div className="grid grid-cols-3 gap-3 text-[13px]">
          {byMethod.map((m) => (
            <div key={m.method}>
              {m.method}: <b>{fmtN(m.amount)}</b>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={`Egg production — ${label}`}
        onCsv={() =>
          downloadCsv(
            file("egg-production"),
            prod.map((p) => ({
              date: p.date,
              house: p.house,
              eggs: p.eggs,
              cracked: p.cracked,
              rejects: p.rejects,
              good: p.eggs - p.cracked - p.rejects,
            }))
          )
        }
      >
        <div className="grid grid-cols-2 gap-3 text-[13px] lg:grid-cols-4">
          <div>Good eggs: <b>{fmtK(eggs - cracked - rejects)}</b> (≈ {fmtK((eggs - cracked - rejects) / 30)} crates)</div>
          <div>Cracked: <b>{fmtK(cracked)}</b> · Rejects: <b>{fmtK(rejects)}</b></div>
          <div>Average a day: <b>{days ? fmtK(eggs / days) : "—"}</b></div>
          <div>Lay rate (vs birds now): <b>{days && birds ? `${((100 * eggs) / days / birds).toFixed(1)}%` : "—"}</b></div>
        </div>
      </Section>

      <Section
        title={`Feed mill — ${label}`}
        onCsv={() =>
          downloadCsv(file("feed-mill"), [
            ...runs.map((r) => ({
              type: "production run",
              date: r.date,
              ref: r.run,
              item: r.pname,
              quantity: r.output,
              unit: "kg",
              value: Math.round(r.cost),
            })),
            ...feedSales.map((s) => ({
              type: s.channel === "internal" ? "issued to division" : "sale",
              date: s.date,
              ref: s.buyer,
              item: product(s.product),
              quantity: s.bags,
              unit: "bags",
              value: s.bags * s.price,
            })),
            ...deliveries.map((d) => ({
              type: "ingredient delivery",
              date: d.date,
              ref: "",
              item: ingredient(d.ing),
              quantity: d.kg,
              unit: "kg",
              value: Math.round(d.kg * d.price),
            })),
          ])
        }
      >
        <div className="grid grid-cols-2 gap-3 text-[13px] lg:grid-cols-4">
          <div>Material cost: <b>{fmtN(runCost)}</b></div>
          <div>Cost per kg: <b>{producedKg ? fmtN(runCost / producedKg) : "—"}</b></div>
          <div>
            Feed sales: <b>{fmtN(feedSales.filter((s) => s.channel === "external").reduce((a, s) => a + s.bags * s.price, 0))}</b>
          </div>
          <div>Ingredient spend: <b>{fmtN(deliveries.reduce((a, d) => a + d.kg * d.price, 0))}</b></div>
        </div>
      </Section>

      <Section
        title="Debtors (today)"
        onCsv={() =>
          downloadCsv(
            `argandu-debtors-${S.today}.csv`,
            debtors.map((d) => ({
              buyer: d.name,
              phone: d.phone,
              unpaid_invoices: d.invoices,
              owed: d.owed,
              oldest_unpaid: d.oldest,
            }))
          )
        }
      >
        {debtors.length === 0 ? (
          <div className="text-[13px] text-[#8a9070]">No buyer owes anything.</div>
        ) : (
          <Table>
            <THead>
              <Th>Buyer</Th>
              <Th>Phone</Th>
              <Th right>Unpaid invoices</Th>
              <Th right>Owed</Th>
              <Th>Oldest unpaid</Th>
            </THead>
            <tbody>
              {debtors.map((d) => (
                <TRow key={d.name}>
                  <Td className="font-semibold">{d.name}</Td>
                  <Td className="text-[#59614a]">{d.phone}</Td>
                  <Td right>{d.invoices}</Td>
                  <Td right className="font-semibold">{fmtN(d.owed)}</Td>
                  <Td>{d.oldest}</Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
      <Note>
        Months follow the farm&apos;s calendar (Lagos). &quot;Collected&quot; counts payments
        by the day they were received.
      </Note>
    </>
  );
}
