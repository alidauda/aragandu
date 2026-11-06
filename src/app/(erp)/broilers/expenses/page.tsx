"use client";

import { useState } from "react";

import { BROILER_EXPENSES, expenseLabel } from "@/lib/erp/broilers";
import { fmtD } from "@/lib/erp/derive";
import { fmtKobo, lastDay } from "@/lib/erp/finance";
import { useErp } from "@/lib/erp/store";
import { MonthSelect } from "@/components/erp/FinanceTabs";
import { Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { category: BROILER_EXPENSES[0].key as string, description: "", amount: "", batch: "", date: "" };

/** Broilers' running costs: wages, bedding, medicine, fuel and maintenance. */
export default function BroilerExpenses() {
  const S = useErp();
  const [month, setMonth] = useState(S.today.slice(0, 7));
  const rows = S.broilerExpenses.filter((e) => e.date.slice(0, 7) === month);
  const paged = usePaged(rows, month);
  const total = (key?: string) => rows.filter((e) => !key || e.category === key).reduce((a, e) => a + e.amount, 0);
  const shown = BROILER_EXPENSES.filter((c) => total(c.key) > 0);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const save = async () => {
    if (!form) return;
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError("Enter what it was for.");
    if (!(amount > 0)) return setError("Enter the amount.");
    const r = await S.addBroilerExpense({
      category: form.category,
      description: form.description.trim(),
      amount,
      batch: form.batch || undefined,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Broilers"
        title="Expenses"
        sub="Wages, brooding paper and sawdust, medicine, charcoal and gas, maintenance"
        action={
          <NewButton
            onClick={() => {
              setForm({ ...blank, date: month === S.today.slice(0, 7) ? "" : lastDay(month) });
              setError("");
            }}
          >
            Add expense
          </NewButton>
        }
      />

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Add expense" sub="A cost of raising broilers" onSubmit={() => void save()} submitLabel="Save">
        {form ? (
          <>
            <SelectField
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={BROILER_EXPENSES.map((c) => ({ label: c.label, value: c.key }))}
            />
            <TextField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="20 bags of sawdust" />
            <TextField label="Amount ₦" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="15000" />
            <SelectField
              label="For"
              value={form.batch}
              onChange={(v) => setForm({ ...form, batch: v })}
              options={[
                { label: "All broilers", value: "" },
                ...S.broilerBatches.filter((b) => b.st === "active").map((b) => ({ label: b.batch, value: b.batch })),
              ]}
            />
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Card className="mb-4 px-4 py-3.5">
        <MonthSelect today={S.today} value={month} onChange={setMonth} />
      </Card>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="This month" value={fmtKobo(total())} sub={`${rows.length} entries`} color="#9a6a12" />
        {shown.slice(0, 3).map((c) => (
          <Kpi key={c.key} label={c.label} value={fmtKobo(total(c.key))} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Category</Th>
            <Th>Description</Th>
            <Th>For</Th>
            <Th right>Amount</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={6} className="text-[#84908f]">
                  Nothing recorded for this month yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((e) => (
              <TRow key={e.id}>
                <Td>
                  {fmtD(e.date)}
                  <Recorded at={e.createdAt} date={e.date} />
                </Td>
                <Td>{expenseLabel(e.category)}</Td>
                <Td>{e.description}</Td>
                <Td className="text-[#465657]">{e.batch ?? "All broilers"}</Td>
                <Td right className="font-semibold">
                  {fmtKobo(e.amount)}
                </Td>
                <Td right>
                  <DeleteButton kind="broilerExpense" id={e.id} what={`"${e.description}"`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>An expense set against a batch counts in that batch&apos;s costs on Analysis, with the cost of processing it.</Note>
    </>
  );
}
