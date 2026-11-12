"use client";

import { useState } from "react";

import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { MANURE } from "@/lib/erp/products";
import { Badge, Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SecondButton, SelectField, TextField } from "@/components/erp/Drawer";
import { EditManure } from "@/components/erp/EditEntry";

const blank = { batch: "", bags: "", price: "", cust: "", walkIn: "", date: "" };

/** Bags of manure collected from each flock, and what they sold for. */
export default function LayersManure() {
  const S = useErp();
  const rows = S.manure;
  const paged = usePaged(rows);
  const month = S.today.slice(0, 7);
  const inStore = (batch?: string) =>
    rows.filter((m) => m.batch === batch).reduce((a, m) => a + (m.kind === "sold" ? -m.bags : m.bags), 0);
  const stock = rows.reduce((a, m) => a + (m.kind === "sold" ? -m.bags : m.bags), 0);
  const thisMonth = rows.filter((m) => m.date.slice(0, 7) === month);

  const [kind, setKind] = useState<"produced" | "sold" | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const flocks = S.batches.filter((b) => b.st === "active");
  const batch = form.batch === "reserve" ? "" : form.batch || flocks[0]?.batch || "";
  const open = (k: "produced" | "sold") => {
    setForm(blank);
    setError("");
    setKind(k);
  };
  const save = async () => {
    const bags = Number(form.bags);
    const price = Number(form.price);
    if (!Number.isInteger(bags) || bags <= 0) return setError("Enter a whole number of bags.");
    if (kind === "sold") {
      if (!Number.isInteger(price) || price <= 0) return setError("Enter the price per bag in whole naira.");
      if (bags > inStore(batch || undefined)) return setError(`Only ${inStore(batch || undefined)} bags in store for that.`);
      if (form.cust === "" && !form.walkIn.trim()) return setError("Choose the buyer, or enter the walk-in buyer's name.");
    }
    // A sale goes on an invoice, so its money is followed like any other sale.
    const r =
      kind === "sold"
        ? await S.addInvoice({
            cust: form.cust === "" ? null : Number(form.cust),
            walkIn: form.walkIn.trim(),
            product: MANURE,
            qty: bags,
            price,
            manureFrom: batch,
            date: form.date || undefined,
          })
        : await S.addManure({ kind: "produced", batch: batch || undefined, bags, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    setKind(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Manure"
        sub="Bags collected from each flock, and what they sold for"
        action={
          <div className="flex flex-wrap gap-2">
            {S.canDo("eggsales") ? (<SecondButton onClick={() => open("sold")}>Record sale</SecondButton>) : null}
            <NewButton onClick={() => open("produced")}>Record manure</NewButton>
          </div>
        }
      />

      <Drawer
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind === "sold" ? "Record manure sale" : "Record manure"}
        sub={kind === "sold" ? "It comes off that flock's bags, on an invoice" : "Bags collected from a flock"}
        onSubmit={() => void save()}
        submitLabel="Record"
      >
        <SelectField
          label="Flock"
          value={form.batch || flocks[0]?.batch || "reserve"}
          onChange={(v) => setForm({ ...form, batch: v })}
          options={[
            ...flocks.map((b) => ({
              label: kind === "sold" ? `${b.batch} (${fmtK(inStore(b.batch))} bags)` : b.batch,
              value: b.batch,
            })),
            { label: kind === "sold" ? `Reserve (${fmtK(inStore())} bags)` : "Reserve", value: "reserve" },
          ]}
        />
        {kind === "sold" ? (
          <>
            <FieldRow>
              <TextField label="Bags" type="number" value={form.bags} onChange={(v) => setForm({ ...form, bags: v })} placeholder="10" />
              <TextField label="Price per bag ₦" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="12000" />
            </FieldRow>
            <SelectField
              label="Buyer"
              value={form.cust}
              onChange={(v) => setForm({ ...form, cust: v })}
              options={[{ label: "Walk-in buyer", value: "" }, ...S.customers.filter((c) => !c.archived).map((c) => ({ label: c.name, value: String(c.id) }))]}
            />
            {form.cust === "" ? (
              <TextField label="Walk-in buyer's name" value={form.walkIn} onChange={(v) => setForm({ ...form, walkIn: v })} />
            ) : null}
            {Number(form.bags) > 0 && Number(form.price) > 0 ? (
              <div className="-mt-1 text-[13px] text-[#465657]">
                <span className="font-semibold">{fmtN(Number(form.bags) * Number(form.price))}</span> on the invoice — payments are recorded on Sales &amp; invoices.
              </div>
            ) : null}
          </>
        ) : (
          <TextField label="Bags" type="number" value={form.bags} onChange={(v) => setForm({ ...form, bags: v })} placeholder="10" />
        )}
        <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Kpi label="In store" value={`${fmtK(stock)} bags`} sub="all flocks and the reserve" color="#055a5b" />
        <Kpi
          label="Collected this month"
          value={`${fmtK(thisMonth.filter((m) => m.kind === "produced").reduce((a, m) => a + m.bags, 0))} bags`}
        />
        <Kpi
          label="Sold this month"
          value={fmtN(thisMonth.filter((m) => m.kind === "sold").reduce((a, m) => a + m.amount, 0))}
          sub={`${fmtK(thisMonth.filter((m) => m.kind === "sold").reduce((a, m) => a + m.bags, 0))} bags`}
          color="#016559"
        />
      </div>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Flock</Th>
            <Th>Type</Th>
            <Th right>Bags</Th>
            <Th right>Amount</Th>
            <Th>Buyer</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  No manure recorded yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((m) => (
              <TRow key={m.id}>
                <Td>
                  {fmtD(m.date)}
                  <Recorded at={m.createdAt} date={m.date} />
                </Td>
                <Td className="font-semibold">{m.batch ?? "Reserve"}</Td>
                <Td>
                  <Badge
                    label={m.kind === "sold" ? "sold" : "collected"}
                    bg={m.kind === "sold" ? "#e3efee" : "#ebf0ef"}
                    fg={m.kind === "sold" ? "#044647" : "#5d6b6b"}
                  />
                </Td>
                <Td right>{fmtK(m.bags)}</Td>
                <Td right>{m.kind === "sold" ? fmtN(m.amount) : "—"}</Td>
                <Td className="text-[#465657]">{m.buyer || "—"}</Td>
                <Td right className="whitespace-nowrap">
                  {m.invoiceId ? (
                    <span className="text-[12px] text-[#84908f]">on INV-{String(m.invoiceId).padStart(5, "0")}</span>
                  ) : (
                    <>
                      <EditManure m={m} />
                      <DeleteButton kind="manure" id={m.id} what={`the ${fmtD(m.date)} manure entry`} />
                    </>
                  )}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Each flock&apos;s bags and sales go into its line on the monthly summary. Enter any manure already in store as
        collected, dated before the month it was carried into.
      </Note>
    </>
  );
}
