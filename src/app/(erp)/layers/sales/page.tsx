"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { balance, fmtD, fmtN, receivablesOf, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
  FormError,
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
  DeleteButton,
} from "@/components/erp/ui";

export default function LayersSales() {
  const S = useErp();
  const rows = [...S.invoices].sort((a, b) => b.date.localeCompare(a.date));

  const receivables = receivablesOf(S.invoices);
  // Counted by when the money arrived, not when the invoice was raised.
  const collected = S.payments
    .filter((p) => p.date >= S.today.slice(0, 8) + "01")
    .reduce((a, p) => a + p.amount, 0);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const cratePriceText = S.cratePrice > 0 ? String(S.cratePrice) : "";
  const [form, setForm] = useState({
    cust: "walk-in",
    walkIn: "",
    product: "Eggs (crates)",
    qty: "",
    price: cratePriceText,
    status: "pending",
  });

  // Admin: money in against an invoice (part or whole).
  const [payFor, setPayFor] = useState<number | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "transfer", reference: "" });
  const [payError, setPayError] = useState("");
  const payInvoice = S.invoices.find((v) => v.id === payFor);
  const savePayment = async () => {
    if (!payInvoice) return;
    const amount = Number(payment.amount);
    if (!(amount > 0)) return setPayError("Enter the amount received.");
    if (amount > balance(payInvoice)) {
      return setPayError(`That's more than the ${fmtN(balance(payInvoice))} outstanding.`);
    }
    setPayError("");
    const r = await S.recordPayment({
      invoiceId: payInvoice.id,
      amount,
      method: payment.method as "transfer",
      reference: payment.reference.trim(),
    });
    if (!r.ok) return setPayError(r.error);
    setPayFor(null);
  };

  const start = () => {
    // Price follows the current crate price, which may have changed since.
    setForm({ ...form, walkIn: "", qty: "", product: "Eggs (crates)", price: cratePriceText });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    const qty = parseInt(form.qty, 10);
    const price = parseFloat(form.price);
    const cust = form.cust === "walk-in" ? null : +form.cust;
    if (cust === null && !form.walkIn.trim()) return setError("Enter the walk-in buyer's name.");
    if (!qty || qty <= 0) return setError("Enter a quantity above 0.");
    if (!price || price <= 0) return setError("Enter a unit price above 0.");
    setError("");
    const name =
      cust === null
        ? `${form.walkIn.trim()} (walk-in)`
        : S.customers.find((c) => c.id === cust)!.name;
    if (!(await S.addInvoice({
      cust,
      name,
      product: form.product,
      qty,
      price,
      status: form.status as "paid" | "pending",
      ...(form.product === "Spent hens" ? { unit: "birds" } : {}),
    })).ok) return;
    setForm({ ...form, walkIn: "", qty: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Sales & invoices"
        sub="Crate sales, spent hens and receivables"
        action={<NewButton onClick={start}>Record sale</NewButton>}
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
            onChange={(v) =>
              setForm({ ...form, product: v, price: v === "Eggs (crates)" ? cratePriceText : "" })
            }
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
        {error ? <div className="text-[12.5px] text-[#c7402f]">{error}</div> : null}
      </Drawer>
      <Drawer
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title="Record payment"
        sub={
          payInvoice
            ? `${payInvoice.name} · ${fmtN(balance(payInvoice))} outstanding of ${fmtN(payInvoice.qty * payInvoice.price)}`
            : ""
        }
        onSubmit={() => void savePayment()}
        submitLabel="Record payment"
      >
        <FieldRow>
          <TextField
            label="Amount ₦"
            type="number"
            value={payment.amount}
            onChange={(v) => setPayment({ ...payment, amount: v })}
          />
          <SelectField
            label="Method"
            value={payment.method}
            onChange={(v) => setPayment({ ...payment, method: v })}
            options={[
              { label: "Bank transfer", value: "transfer" },
              { label: "Cash", value: "cash" },
              { label: "POS", value: "pos" },
            ]}
          />
        </FieldRow>
        <TextField
          label="Reference (optional)"
          value={payment.reference}
          onChange={(v) => setPayment({ ...payment, reference: v })}
          placeholder="Transfer ref / receipt no."
        />
        <FormError message={payError} />
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
            <Th right>Balance</Th>
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
                  <Td right>
                    {v.status === "paid" ? (
                      "—"
                    ) : (
                      <span className="font-semibold text-[#9a6a12]">{fmtN(balance(v))}</span>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      label={v.status === "pending" && v.paid > 0 ? "part-paid" : v.status}
                      bg={b.bg}
                      fg={b.fg}
                    />
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {/* Money is an admin's call: staff see the status only. */}
                    <a
                      href={`/invoices/${v.id}`}
                      target="_blank"
                      className="mr-1 rounded-md px-1.5 text-[12px] font-semibold text-[#2f8f46] opacity-70 hover:opacity-100"
                    >
                      Invoice
                    </a>
                    {S.isAdmin && v.status === "pending" ? (
                      <button
                        onClick={() => {
                          setPayFor(v.id);
                          setPayment({ amount: String(balance(v)), method: "transfer", reference: "" });
                          setPayError("");
                        }}
                        disabled={S.saving}
                        className="rounded-lg border border-[#cfe3d3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#2f8f46]"
                      >
                        Record payment
                      </button>
                    ) : null}
                    {S.isAdmin && v.paid > 0 ? (
                      <button
                        onClick={() => {
                          if (window.confirm("Remove all payments on this invoice? It will be owed in full again.")) {
                            void S.markUnpaid(v);
                          }
                        }}
                        disabled={S.saving}
                        className="rounded-md px-1.5 text-[12px] font-semibold text-[#b3473a] opacity-70 hover:opacity-100"
                      >
                        Undo payments
                      </button>
                    ) : null}
                    {v.status === "pending" && v.paid === 0 ? (
                      <DeleteButton
                        kind="invoice"
                        id={v.id}
                        what={
                          v.orderId
                            ? "this invoice (its order goes back to pending)"
                            : "this invoice"
                        }
                      />
                    ) : null}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="mt-3 flex gap-5 text-[13px] text-[#4c5a51]">
        <div>
          Receivables:{" "}
          <span className="font-bold text-[#b57a12]">{fmtN(receivables)}</span>
        </div>
        <div>
          Collected this month:{" "}
          <span className="font-bold text-[#2f8f46]">{fmtN(collected)}</span>
        </div>
      </div>
    </>
  );
}
