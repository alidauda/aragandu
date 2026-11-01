"use client";

import { useState } from "react";

import { fmtD } from "@/lib/erp/derive";
import { categoryLabel, EXPENSE_CATEGORIES, fmtKobo, INCOME_CATEGORIES, lastDay } from "@/lib/erp/finance";
import { useErp } from "@/lib/erp/store";
import { FinanceTabs, MonthSelect } from "@/components/erp/FinanceTabs";
import { Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { category: "", description: "", amount: "", batch: "", date: "" };

/** What the farm spent and earned outside its egg, feed and manure records. */
export default function FinanceEntries() {
  const S = useErp();
  const [month, setMonth] = useState(S.today.slice(0, 7));
  const rows = S.financeEntries.filter((e) => e.date.slice(0, 7) === month);
  const paged = usePaged(rows, month);
  const total = (kind: "expense" | "income") => rows.filter((e) => e.kind === kind).reduce((a, e) => a + e.amount, 0);

  const [kind, setKind] = useState<"expense" | "income" | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const open = (k: "expense" | "income") => {
    // Entries for a past month default to its last day.
    setForm({ ...blank, date: month === S.today.slice(0, 7) ? "" : lastDay(month) });
    setError("");
    setKind(k);
  };
  const save = async () => {
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError("Enter what it was for.");
    if (!(amount > 0)) return setError("Enter the amount.");
    const r = await S.addFinanceEntry({
      kind: kind!,
      category: form.category || categories[0].key,
      description: form.description.trim(),
      amount,
      batch: form.batch || undefined,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setKind(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Expenses and income"
        sub="Salary, running costs and anything else that isn't recorded elsewhere"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => open("income")}
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
            >
              Add income
            </button>
            <NewButton onClick={() => open("expense")}>Add expense</NewButton>
          </div>
        }
      />
      <FinanceTabs />

      <Drawer
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind === "income" ? "Add income" : "Add expense"}
        sub={kind === "income" ? "Orchard and other sales" : "It appears on the month's summary"}
        onSubmit={() => void save()}
        submitLabel="Save"
      >
        <SelectField
          label="Category"
          value={form.category || categories[0].key}
          onChange={(v) => setForm({ ...form, category: v })}
          options={categories.map((c) => ({ label: c.label, value: c.key }))}
        />
        <TextField
          label="Description"
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
          placeholder="Repair of canter van"
        />
        <TextField label="Amount ₦" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="20000" />
        {kind === "expense" ? (
          <SelectField
            label="For"
            value={form.batch}
            onChange={(v) => setForm({ ...form, batch: v })}
            options={[
              { label: "The whole farm", value: "" },
              ...S.batches.filter((b) => b.st === "active").map((b) => ({ label: b.batch, value: b.batch })),
            ]}
          />
        ) : null}
        <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        <FormError message={error} />
      </Drawer>

      <Card className="mb-4 px-4 py-3.5">
        <MonthSelect today={S.today} value={month} onChange={setMonth} />
      </Card>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Kpi label="Expenses" value={fmtKobo(total("expense"))} sub={`${rows.filter((e) => e.kind === "expense").length} entries`} color="#9a6a12" />
        <Kpi label="Other income" value={fmtKobo(total("income"))} sub={`${rows.filter((e) => e.kind === "income").length} entries`} color="#055a5b" />
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
                <Td>{categoryLabel(e.category)}</Td>
                <Td>{e.description}</Td>
                <Td className="text-[#465657]">{e.batch ?? "Whole farm"}</Td>
                <Td right className="font-semibold">
                  <span style={{ color: e.kind === "income" ? "#016559" : undefined }}>{fmtKobo(e.amount)}</span>
                </Td>
                <Td right>
                  <DeleteButton kind="financeEntry" id={e.id} what={`"${e.description}"`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Feed, eggs, manure and sold birds come from their own records, so don&apos;t enter them here. An expense set
        against a growing flock counts in that flock&apos;s costs and its batch estimate.
      </Note>
    </>
  );
}
