"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtN, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import {
  Badge,
  Card,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function LayersSales() {
  const S = useErp();
  const rows = [...S.invoices].sort((a, b) => b.date.localeCompare(a.date));

  const receivables = S.invoices
    .filter((v) => v.status === "pending")
    .reduce((a, v) => a + v.qty * v.price, 0);
  const collected = S.invoices
    .filter((v) => v.status === "paid" && v.date >= S.today.slice(0, 8) + "01")
    .reduce((a, v) => a + v.qty * v.price, 0);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cust: "walk-in",
    walkIn: "",
    product: "Eggs (crates)",
    qty: "",
    price: String(S.cratePrice),
    status: "pending",
  });

  const save = () => {
    const qty = parseInt(form.qty, 10);
    const price = parseFloat(form.price);
    if (!qty || qty <= 0 || !price || price <= 0) return;
    const cust = form.cust === "walk-in" ? null : +form.cust;
    const name =
      cust === null
        ? `${form.walkIn.trim() || "Walk-in"} (walk-in)`
        : S.customers.find((c) => c.id === cust)!.name;
    if (cust === null && !form.walkIn.trim()) return;
    S.addInvoice({
      cust,
      name,
      product: form.product,
      qty,
      price,
      status: form.status as "paid" | "pending",
      ...(form.product === "Spent hens" ? { unit: "birds" } : {}),
    });
    setForm({ ...form, walkIn: "", qty: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Sales & invoices"
        sub="Crate sales, spent hens and receivables"
        action={<NewButton onClick={() => setOpen(true)}>Record sale</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record sale"
        sub="A crate sale draws egg stock down on its own"
        onSubmit={save}
        submitLabel="Record sale"
      >
        <SelectField
          label="Customer"
          value={form.cust}
          onChange={(v) => setForm({ ...form, cust: v })}
          options={[
            { label: "Walk-in (name only)", value: "walk-in" },
            ...S.customers.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
        {form.cust === "walk-in" ? (
          <TextField
            label="Walk-in name"
            value={form.walkIn}
            onChange={(v) => setForm({ ...form, walkIn: v })}
            placeholder="Chuka Obi"
          />
        ) : null}
        <FieldRow>
          <SelectField
            label="Product"
            value={form.product}
            onChange={(v) => setForm({ ...form, product: v })}
            options={[
              { label: "Eggs (crates)", value: "Eggs (crates)" },
              { label: "Spent hens", value: "Spent hens" },
            ]}
          />
          <SelectField
            label="Payment"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={[
              { label: "Pending", value: "pending" },
              { label: "Paid", value: "paid" },
            ]}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={form.product === "Spent hens" ? "Birds" : "Crates"}
            type="number"
            value={form.qty}
            onChange={(v) => setForm({ ...form, qty: v })}
            placeholder="20"
          />
          <TextField
            label="Unit price ₦"
            type="number"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
          />
        </FieldRow>
      </Drawer>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Customer</Th>
            <Th>Product</Th>
            <Th right>Qty</Th>
            <Th right>Unit price</Th>
            <Th right>Amount</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.map((v) => {
              const b = stBadge(v.status);
              return (
                <TRow key={v.id}>
                  <Td>{fmtD(v.date)}</Td>
                  <Td className="font-semibold">{v.name}</Td>
                  <Td>{v.product}</Td>
                  <Td right>
                    {v.qty} {v.unit || "crates"}
                  </Td>
                  <Td right>{fmtN(v.price)}</Td>
                  <Td right className="font-semibold">
                    {fmtN(v.qty * v.price)}
                  </Td>
                  <Td>
                    <Badge label={v.status} bg={b.bg} fg={b.fg} />
                  </Td>
                  <Td right>
                    {v.status === "pending" ? (
                      <button
                        onClick={() => S.markPaid(v)}
                        className="rounded-lg border border-[#b9c49f] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#3c4d28]"
                      >
                        Mark paid
                      </button>
                    ) : null}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="mt-3 flex gap-5 text-[13px] text-[#59614a]">
        <div>
          Receivables:{" "}
          <span className="font-bold text-[#b97a12]">{fmtN(receivables)}</span>
        </div>
        <div>
          Collected this month:{" "}
          <span className="font-bold text-[#3c4d28]">{fmtN(collected)}</span>
        </div>
      </div>
    </>
  );
}
