"use client";

import { useState } from "react";

import { BROILER_PRODUCTS, broilersAlive, fmtKg, PARTS, partOf, partsInStore, PULLET_PRODUCT } from "@/lib/erp/broilers";
import { balance, fmtD, fmtK, fmtN, stBadge } from "@/lib/erp/derive";
import { useBirdUnit } from "@/components/erp/useUnit";
import { receiptsOf, usePayments } from "@/components/erp/PaymentDrawer";
import { ReceiptChip, StaffUpload } from "@/components/erp/Receipts";
import { Badge, Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { what: "live", batch: "", cust: "", walkIn: "", birds: "", kg: "", pricing: "bird", price: "", paid: "", reference: "", date: "" };

/** Broilers sold live (by the bird or kg) and processed (carcass, head and feet, gizzard), each on an invoice. */
export default function BroilerSales() {
  const S = useBirdUnit();
  // Recording money is for money admins (Accounts, a Broilers admin, the owner).
  const money = S.canDo("money", "admin");
  const pay = usePayments();
  const saleOf = (invoiceId: number) => S.broilerSales.find((x) => x.invoiceId === invoiceId);
  const processedOf = (invoiceId: number) => S.processedSales.find((x) => x.invoiceId === invoiceId);
  const store = partsInStore(S);
  const rows = S.invoices
    .filter((v) => (S.unit === "brooding" ? v.product === PULLET_PRODUCT : BROILER_PRODUCTS.includes(v.product)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const paged = usePaged(rows);
  const month = S.today.slice(0, 7);
  const monthSales = S.broilerSales.filter((x) => x.date.slice(0, 7) === month);
  const monthInvoices = rows.filter((v) => v.date.slice(0, 7) === month);
  const owed = rows.filter((v) => v.status === "pending").reduce((a, v) => a + balance(v), 0);

  const active = S.broilerBatches.filter((b) => b.st === "active");
  const alive = (code: string) => {
    const b = S.broilerBatches.find((x) => x.batch === code);
    return b ? broilersAlive(b, S) : 0;
  };
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const batch = form?.batch || active[0]?.batch || "";
  const birds = Number(form?.birds);
  const kg = Number(form?.kg);
  const price = Number(form?.price);
  const live = form?.what === "live";
  const part = live ? null : partOf(form?.what ?? "carcass");
  const inStore = part ? (store.find((p) => p.key === part.key)?.stock ?? 0) : 0;
  const total = form?.pricing === "kg" ? kg * price : birds * price;

  const save = async () => {
    if (!form) return;
    if (form.cust === "" && !form.walkIn.trim()) return setError("Choose the buyer, or enter the walk-in buyer's name.");
    const paid = money && form.paid ? { method: form.paid as "cash", reference: form.reference.trim() } : undefined;
    const buyer = { cust: form.cust === "" ? null : Number(form.cust), walkIn: form.walkIn.trim() };
    if (part) {
      if (!(kg > 0)) return setError("Enter the weight sold, in kg.");
      if (kg > inStore + 1e-9) return setError(`Only ${fmtKg(inStore, 1)} of ${part.label.toLowerCase()} in store.`);
      if (form.pricing === "kg" && !Number.isInteger(kg)) return setError("Weigh to the whole kg when selling by the kg.");
      if (form.pricing === "bird" && (!Number.isInteger(birds) || birds <= 0)) return setError("Enter how many birds.");
      if (!Number.isInteger(price) || price <= 0) return setError("Enter the price in whole naira.");
      const r = await S.sellProcessed({
        part: part.key,
        kg,
        pieces: form.pricing === "bird" ? birds : 0,
        pricing: form.pricing === "kg" ? "kg" : "piece",
        price,
        ...buyer,
        paid,
        date: form.date || undefined,
      });
      if (!r.ok) return setError(r.error);
      return setForm(null);
    }
    if (!batch) return setError("Add a batch first.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the birds sold.");
    if (birds > alive(batch)) return setError(`${batch} only has ${fmtK(alive(batch))} birds.`);
    if (!(kg > 0)) return setError("Enter their live weight together, in kg.");
    if (form.pricing === "kg" && !Number.isInteger(kg)) return setError("Weigh to the whole kg when selling by the kg.");
    if (!Number.isInteger(price) || price <= 0) return setError("Enter the price in whole naira.");
    const r = await S.sellBroilers({
      batch,
      birds,
      kg,
      pricing: form.pricing as "bird",
      price,
      ...buyer,
      paid,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={S.u.label}
        title="Sales"
        sub={S.unit === "brooding" ? "Birds sold from brooding, each on an invoice" : "Live birds, and processed chicken from store, each on an invoice"}
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

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title="Record sale"
        sub={live ? "The birds come off their batch" : "It comes out of the processed store"}
        onSubmit={() => void save()}
        submitLabel="Record sale"
      >
        {form ? (
          <>
            <SelectField
              label="What"
              value={form.what}
              onChange={(v) => setForm({ ...form, what: v, pricing: v === "live" || v === "carcass" ? form.pricing : "kg" })}
              options={[
                { label: "Live birds", value: "live" },
                // Processed chicken is Broilers' only.
                ...(S.unit === "broilers"
                  ? PARTS.map((p) => ({ label: `${p.label} (${fmtKg(store.find((x) => x.key === p.key)?.stock ?? 0, 1)} in store)`, value: p.key }))
                  : []),
              ]}
            />
            {live ? (
              <SelectField
                label="Batch"
                value={batch}
                onChange={(v) => setForm({ ...form, batch: v })}
                options={active.map((b) => ({ label: `${b.batch} (${fmtK(alive(b.batch))} birds)`, value: b.batch }))}
              />
            ) : null}
            <SelectField
              label="Buyer"
              value={form.cust}
              onChange={(v) => setForm({ ...form, cust: v })}
              options={[
                { label: "Walk-in buyer", value: "" },
                ...S.customers.filter((c) => !c.archived).map((c) => ({ label: c.name, value: String(c.id) })),
              ]}
            />
            {form.cust === "" ? (
              <TextField label="Walk-in buyer's name" value={form.walkIn} onChange={(v) => setForm({ ...form, walkIn: v })} placeholder="Musa Abdullahi" />
            ) : null}
            {live || (part?.key === "carcass" && form.pricing === "bird") ? (
              <FieldRow>
                <TextField label="Birds" type="number" value={form.birds} onChange={(v) => setForm({ ...form, birds: v })} placeholder="200" />
                <TextField
                  label={live ? "Live weight (kg)" : "Carcass weight (kg)"}
                  type="number"
                  value={form.kg}
                  onChange={(v) => setForm({ ...form, kg: v })}
                  placeholder="480"
                />
              </FieldRow>
            ) : (
              <TextField label={`${part?.label ?? ""} weight (kg)`} type="number" value={form.kg} onChange={(v) => setForm({ ...form, kg: v })} placeholder="50" />
            )}
            <FieldRow>
              <SelectField
                label="Priced"
                value={form.pricing}
                onChange={(v) => setForm({ ...form, pricing: v })}
                options={
                  live || part?.key === "carcass"
                    ? [
                        { label: "Per bird", value: "bird" },
                        { label: "Per kg", value: "kg" },
                      ]
                    : [{ label: "Per kg", value: "kg" }]
                }
              />
              <TextField
                label={form.pricing === "kg" ? "Price per kg ₦" : "Price per bird ₦"}
                type="number"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
                placeholder={form.pricing === "kg" ? "2500" : "6000"}
              />
            </FieldRow>
            {kg > 0 && price > 0 ? (
              <div className="-mt-1 text-[13px] text-[#465657]">
                {form.pricing === "bird" && birds > 0 ? `${fmtKg(kg / birds, 2)} a bird · ` : ""}
                <span className="font-semibold">{fmtN(total)}</span> in all
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
                {form.paid ? (
                  <TextField label="Reference (optional)" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} />
                ) : (
                  <div />
                )}
              </FieldRow>
            ) : null}
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Kpi
          label="Sold this month"
          value={fmtN(monthInvoices.reduce((a, v) => a + v.qty * v.price, 0))}
          sub={`${fmtK(monthSales.reduce((a, x) => a + x.birds, 0))} birds · ${fmtKg(monthSales.reduce((a, x) => a + x.kg, 0), 0)}`}
          color="#055a5b"
        />
        <Kpi
          label="Average weight sold"
          value={fmtKg(monthSales.reduce((a, x) => a + x.birds, 0) ? monthSales.reduce((a, x) => a + x.kg, 0) / monthSales.reduce((a, x) => a + x.birds, 0) : null)}
          sub="this month"
        />
        <Kpi label="Owed" value={fmtN(owed)} sub="on these invoices" color={owed ? "#9a6a12" : undefined} />
      </div>

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Buyer</Th>
            <Th>What</Th>
            <Th right>Birds</Th>
            <Th right>Weight</Th>
            <Th right>Price</Th>
            <Th right>Amount</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={9} className="text-[#84908f]">
                  No broilers sold yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((v) => {
              const sale = saleOf(v.id);
              const done = processedOf(v.id);
              const b = stBadge(v.status);
              return (
                <TRow key={v.id}>
                  <Td>
                    {fmtD(v.date)}
                    <Recorded at={v.createdAt} date={v.date} />
                  </Td>
                  <Td className="font-semibold">{v.name}</Td>
                  <Td>
                    {sale ? "Live" : done ? partOf(done.part).label : v.product}
                    {sale ? <div className="text-[12px] text-[#84908f]">{sale.batch}</div> : null}
                  </Td>
                  <Td right>{sale ? fmtK(sale.birds) : done?.pieces ? fmtK(done.pieces) : "—"}</Td>
                  <Td right>
                    {sale ? fmtKg(sale.kg, 1) : done ? fmtKg(done.kg, 1) : "—"}
                    {sale && sale.birds ? <div className="text-[11.5px] text-[#84908f]">{fmtKg(sale.kg / sale.birds, 2)} a bird</div> : null}
                  </Td>
                  <Td right>
                    {fmtN(v.price)}
                    <div className="text-[11.5px] text-[#84908f]">per {v.unit === "kg" ? "kg" : "bird"}</div>
                  </Td>
                  <Td right className="font-semibold">
                    {fmtN(v.qty * v.price)}
                    {v.status === "pending" && v.paid > 0 ? <div className="text-[11.5px] font-normal text-[#9a6a12]">{fmtN(balance(v))} due</div> : null}
                  </Td>
                  <Td>
                    <Badge label={v.status === "pending" ? (v.paid > 0 ? "part-paid" : v.cust === null ? "cash due" : "pending") : "paid"} bg={b.bg} fg={b.fg} />
                    <ReceiptChip proofs={receiptsOf(S.proofs, v)} />
                    {v.status === "pending" ? (
                      <div className="mt-0.5">
                        <StaffUpload kind="invoice" id={v.id} due={balance(v)} customerId={v.cust} product={v.product} />
                      </div>
                    ) : null}
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <a
                      href={`/invoices/${v.id}`}
                      target="_blank"
                      className="mr-1 rounded-md px-1.5 text-[12px] font-semibold text-[#055a5b] opacity-70 hover:opacity-100"
                    >
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
                    <DeleteButton
                      kind="invoice"
                      id={v.id}
                      what={`this invoice${v.paid > 0 ? ` and its ${fmtN(v.paid)} of payments` : ""} (${sale ? "the birds go back to their batch" : "it goes back into store"})`}
                    />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Enter the live weight even when selling live birds by the bird: it gives the weight sold and FCR on Analysis.
        Carcass, head and feet and gizzard sell from what Processing put into store. A registered buyer gets the invoice
        by email and sees it in their portal. Only an admin records money received.
      </Note>
    </>
  );
}
