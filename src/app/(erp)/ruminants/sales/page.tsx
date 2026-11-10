"use client";

import { useState } from "react";

import { RUMINANT_PRODUCTS, SPECIES } from "@/lib/erp/broilers";
import { balance, fmtD, fmtK, fmtN, stBadge } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { AnimalPicker } from "@/components/erp/AnimalPicker";
import { receiptsOf, usePayments } from "@/components/erp/PaymentDrawer";
import { ReceiptChip, StaffUpload } from "@/components/erp/Receipts";
import { Badge, Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { species: "goat", animals: [] as number[], cust: "", walkIn: "", price: "", paid: "", reference: "", date: "" };

/** Animals sold, one species to an invoice, at a price a head. */
export default function RuminantSales() {
  const S = useErp();
  const money = S.canDo("money", "admin");
  const pay = usePayments();
  const rows = S.invoices.filter((v) => RUMINANT_PRODUCTS.includes(v.product)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const paged = usePaged(rows);
  const month = S.today.slice(0, 7);
  const monthRows = rows.filter((v) => v.date.slice(0, 7) === month);
  const owed = rows.filter((v) => v.status === "pending").reduce((a, v) => a + balance(v), 0);
  const tagsOn = (id: number) => S.animals.filter((a) => a.invoiceId === id).map((a) => a.tag);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const save = async () => {
    if (!form) return;
    if (form.cust === "" && !form.walkIn.trim()) return setError("Choose the buyer, or enter the walk-in buyer's name.");
    if (form.animals.length === 0) return setError("Choose the animals sold.");
    const price = Number(form.price);
    if (!Number.isInteger(price) || price <= 0) return setError("Enter the price a head in whole naira.");
    const r = await S.sellAnimals({
      animals: form.animals,
      price,
      cust: form.cust === "" ? null : Number(form.cust),
      walkIn: form.walkIn.trim(),
      paid: money && form.paid ? { method: form.paid as "cash", reference: form.reference.trim() } : undefined,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Sales"
        sub="Animals sold, by the head, each sale on an invoice"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Record sale
          </NewButton>
        }
      />
      {pay.drawer}

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record sale" sub="The animals leave the herd" onSubmit={() => void save()} submitLabel="Record sale">
        {form ? (
          <>
            <SelectField
              label="Species"
              value={form.species}
              onChange={(v) => setForm({ ...form, species: v, animals: [] })}
              options={SPECIES.map((s) => ({ label: s.label, value: s.key }))}
            />
            <AnimalPicker
              animals={S.animals.filter((a) => a.status === "active" && a.species === form.species)}
              value={form.animals}
              onChange={(animals) => setForm({ ...form, animals })}
              label="Animals sold"
            />
            <SelectField
              label="Buyer"
              value={form.cust}
              onChange={(v) => setForm({ ...form, cust: v })}
              options={[{ label: "Walk-in buyer", value: "" }, ...S.customers.filter((c) => !c.archived).map((c) => ({ label: c.name, value: String(c.id) }))]}
            />
            {form.cust === "" ? <TextField label="Walk-in buyer's name" value={form.walkIn} onChange={(v) => setForm({ ...form, walkIn: v })} /> : null}
            <TextField label="Price a head ₦" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="85000" />
            {form.animals.length && Number(form.price) > 0 ? (
              <div className="-mt-1 text-[13px] text-[#465657]">
                {form.animals.length} × {fmtN(Number(form.price))} = <span className="font-semibold">{fmtN(form.animals.length * Number(form.price))}</span>
              </div>
            ) : null}
            {money ? (
              <FieldRow>
                <SelectField
                  label="Paid now?"
                  value={form.paid}
                  onChange={(v) => setForm({ ...form, paid: v })}
                  options={[
                    { label: "Not yet", value: "" },
                    { label: "Cash", value: "cash" },
                    { label: "Bank transfer", value: "transfer" },
                    { label: "POS", value: "pos" },
                  ]}
                />
                {form.paid ? <TextField label="Reference (optional)" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} /> : <div />}
              </FieldRow>
            ) : null}
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Kpi label="Sold this month" value={fmtN(monthRows.reduce((a, v) => a + v.qty * v.price, 0))} sub={`${fmtK(monthRows.reduce((a, v) => a + v.qty, 0))} animals`} color="#055a5b" />
        <Kpi label="Sold in all" value={fmtK(rows.reduce((a, v) => a + v.qty, 0))} sub="animals" />
        <Kpi label="Owed" value={fmtN(owed)} sub="on these invoices" color={owed ? "#9a6a12" : undefined} />
      </div>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Buyer</Th>
            <Th>Animals</Th>
            <Th right>A head</Th>
            <Th right>Amount</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  No animals sold yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((v) => {
              const b = stBadge(v.status);
              const tags = tagsOn(v.id);
              return (
                <TRow key={v.id}>
                  <Td>
                    {fmtD(v.date)}
                    <Recorded at={v.createdAt} date={v.date} />
                  </Td>
                  <Td className="font-semibold">{v.name}</Td>
                  <Td>
                    {v.qty} {v.product.toLowerCase()}
                    <div className="max-w-[260px] truncate text-[12px] text-[#84908f]">{tags.join(", ")}</div>
                  </Td>
                  <Td right>{fmtN(v.price)}</Td>
                  <Td right className="font-semibold">
                    {fmtN(v.qty * v.price)}
                  </Td>
                  <Td>
                    <Badge label={v.status === "pending" ? (v.paid > 0 ? "part-paid" : v.cust === null ? "cash due" : "pending") : "paid"} bg={b.bg} fg={b.fg} />
                    <ReceiptChip proofs={receiptsOf(S.proofs, v)} />
                    {v.status === "pending" ? (
                      <div className="mt-0.5">
                        <StaffUpload kind="invoice" id={v.id} due={balance(v)} product={v.product} />
                      </div>
                    ) : null}
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <a href={`/invoices/${v.id}`} target="_blank" className="mr-1 rounded-md px-1.5 text-[12px] font-semibold text-[#055a5b] opacity-70 hover:opacity-100">
                      Invoice
                    </a>
                    {money && (v.status === "pending" || v.paid > 0) ? (
                      <button
                        onClick={() => pay.open(v.id)}
                        disabled={S.saving}
                        className="rounded-[10px] border border-[#c5dcd9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
                      >
                        {v.status === "pending" ? "Record payment" : "Payments"}
                      </button>
                    ) : null}
                    <DeleteButton kind="invoice" id={v.id} what={`this invoice${v.paid > 0 ? ` and its ${fmtN(v.paid)} of payments` : ""} (the animals come back on the farm)`} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>A registered buyer gets the invoice by email and sees it in their portal. Only an admin records money received.</Note>
    </>
  );
}
