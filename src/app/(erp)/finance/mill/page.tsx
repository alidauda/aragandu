"use client";

import { useState } from "react";

import { fmtK, fmtN } from "@/lib/erp/derive";
import { fmtKobo, millSummary } from "@/lib/erp/finance";
import { useErp } from "@/lib/erp/store";
import { FinanceTabs, MonthSelect } from "@/components/erp/FinanceTabs";
import { Card, CardTitle, Kpi, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

/** The mill's month: ingredients and running costs against each bag's selling price. */
export default function FinanceMill() {
  const S = useErp();
  const [month, setMonth] = useState(S.today.slice(0, 7));
  const m = millSummary(S, month);
  const paged = usePaged(m.products, month);
  const costPage = usePaged(m.lines, month);
  const money = (n: number) => (n < 0 ? `(${fmtN(-n)})` : fmtN(n));

  return (
    <>
      <PageHeader eyebrow="Finance" title="Feed mill" sub="Ingredients and running costs against the selling price of each bag" />
      <FinanceTabs />

      <Card className="mb-4 px-4 py-3.5">
        <MonthSelect today={S.today} value={month} onChange={setMonth} />
      </Card>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Bags made" value={fmtK(m.totals.bags)} sub="from production runs" />
        <Kpi label="Ingredients" value={fmtN(m.totals.ingredients)} sub="at each run's prices" color="#9a6a12" />
        <Kpi label="Running costs" value={fmtN(m.runningCost)} sub="from Expenses" color="#9a6a12" />
        <Kpi
          label="Margin"
          value={money(m.totals.margin)}
          sub={`on ${fmtN(m.totals.value)} of bags`}
          color={m.totals.margin < 0 ? "#c7402f" : "#016559"}
        />
      </div>

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={paged.pager}>
          <THead>
            <Th>Product</Th>
            <Th right>Bags made</Th>
            <Th right>Ingredients</Th>
            <Th right>Running costs</Th>
            <Th right>Cost a bag</Th>
            <Th right>Selling price</Th>
            <Th right>Value of bags</Th>
            <Th right>Margin</Th>
          </THead>
          <tbody>
            {m.products.length === 0 ? (
              <TRow>
                <Td colSpan={8} className="text-[#84908f]">
                  No production runs or feed sales in this month.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((p) => (
              <TRow key={p.id}>
                <Td>
                  <span className="font-semibold">{p.name}</span>
                  <div className="text-[12px] text-[#84908f]">{p.bagKg} kg bag</div>
                </Td>
                <Td right>{fmtK(p.bags)}</Td>
                <Td right>{fmtN(p.ingredients)}</Td>
                <Td right>{fmtN(p.runningShare)}</Td>
                <Td right>{p.bags ? fmtN(p.costPerBag) : "—"}</Td>
                <Td right>{fmtN(p.sellPrice)}</Td>
                <Td right>{fmtN(p.value)}</Td>
                <Td right className="font-semibold">
                  <span style={{ color: p.margin < 0 ? "#c7402f" : "#016559" }}>{money(p.margin)}</span>
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Running costs</CardTitle>
        </div>
        <div className="mt-2">
          <Table pager={costPage.pager}>
            <THead>
              <Th>Item</Th>
              <Th right>Amount</Th>
            </THead>
            <tbody>
              {m.lines.length === 0 ? (
                <TRow>
                  <Td colSpan={2} className="text-[#84908f]">
                    None entered for this month.
                  </Td>
                </TRow>
              ) : null}
              {costPage.rows.map((l) => (
                <TRow key={l.label}>
                  <Td>{l.label}</Td>
                  <Td right>{fmtKobo(l.amount)}</Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Running costs are shared across products by bags made. Selling price is the month&apos;s average from feed sales, or
        the product&apos;s list price if none sold. Enter wages, diesel and electricity, tools and sacks on Expenses and
        income.
      </Note>
    </>
  );
}
