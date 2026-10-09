"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { balance, fmtD, fmtN, receivablesOf, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import {
  Badge,
  Card,
  CardTitle,
  DeleteButton,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

const EGGS = "Eggs (crates)";
const HENS = "Spent hens";
const METHOD = { transfer: "Bank transfer", cash: "Cash", pos: "POS", credit: "From credit" } as const;

export default function LayersSales() {
  const S = useErp();
  const rows = [...S.invoices].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const receivables = receivablesOf(S.invoices);
  // Counted by when the money arrived, not when the invoice was raised.
  const collected = S.payments
    .filter((p) => p.date >= S.today.slice(0, 8) + "01" && p.method !== "credit")
    .reduce((a, p) => a + p.amount, 0);
  // Walk-in sales are cash: they wait here until an admin confirms the money.
  const cashDue = rows.filter((v) => v.cust === null && v.status === "pending");

  // ── Record sale
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const blank = {
    cust: "walk-in",
    walkIn: "",
    product: EGGS,
    qty: "",
    price: "",
    otherPrice: false,
    batch: "",
    paidNow: false,
    method: "cash",
    reference: "",
  };
  const [form, setForm] = useState(blank);
  const activeBatches = S.batches.filter((b) => b.st === "active");
  const batch = activeBatches.find((b) => b.batch === form.batch) ?? activeBatches[0];
  const buyer = S.customers.find((c) => c.id === +form.cust);
  const eggs = form.product === EGGS;

  const save = async () => {
    const qty = Number(form.qty);
    const cust = form.cust === "walk-in" ? null : +form.cust;
    if (cust === null && !form.walkIn.trim()) return setError("Enter the walk-in buyer's name.");
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number above 0.");
    const price = form.price.trim() ? Number(form.price) : undefined;
    if (!eggs && !(price && price > 0)) return setError("Enter the price per bird.");
    if (eggs && form.otherPrice && !(price && price > 0)) return setError("Enter the price per crate.");
    if (!eggs && !batch) return setError("There's no active batch to sell hens from.");
    setError("");
    const r = await S.addInvoice({
      cust,
      walkIn: form.walkIn.trim(),
      product: eggs ? EGGS : HENS,
      qty,
      price: eggs ? (form.otherPrice ? price : undefined) : price,
      batch: eggs ? undefined : batch!.batch,
      paid: form.paidNow
        ? { method: form.method as "cash", reference: form.reference.trim() }
        : undefined,
    });
    if (!r.ok) return setError(r.error);
    setOpen(false);
  };

  // ── Payments (admin)
  const [payFor, setPayFor] = useState<number | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "transfer", reference: "" });
  const [payError, setPayError] = useState("");
  const payInvoice = S.invoices.find((v) => v.id === payFor);
  const payHistory = S.payments.filter((p) => p.invoiceId === payFor);

  const openPay = (id: number) => {
    const v = S.invoices.find((x) => x.id === id)!;
    setPayFor(id);
    setPayment({
      amount: v.status === "pending" ? String(balance(v)) : "",
      method: v.cust === null ? "cash" : "transfer",
      reference: "",
    });
    setPayError("");
  };

  const savePayment = async () => {
    if (!payInvoice) return;
    if (payInvoice.status === "paid") return setPayFor(null);
    const amount = Number(payment.amount);
    if (!(amount > 0)) return setPayError("Enter the amount received.");
    if (payInvoice.cust === null && amount > balance(payInvoice)) {
      return setPayError(`That's more than the ${fmtN(balance(payInvoice))} due; walk-ins can't hold credit.`);
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

  const overpay =
    payInvoice && payInvoice.cust !== null && Number(payment.amount) > balance(payInvoice)
      ? Number(payment.amount) - balance(payInvoice)
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Sales & invoices"
        sub="Crate sales, spent hens, payments and what's owed"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
              setOpen(true);
            }}
          >
            Record sale
          </NewButton>
        }
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record sale"
        sub={
          eggs && form.cust !== "walk-in"
            ? "Crates to a buyer go through their allocation and debt hold, like an order"
            : form.cust === "walk-in"
              ? "Walk-ins pay cash — an admin confirms the money"
              : "Spent hens come out of a batch"
        }
        onSubmit={() => void save()}
        submitLabel="Record sale"
      >
        <SelectField
          label="Customer"
          value={form.cust}
          onChange={(v) => setForm({ ...form, cust: v })}
          options={[
            { label: "Walk-in (pays cash)", value: "walk-in" },
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
            onChange={(v) => setForm({ ...form, product: v, price: "", otherPrice: false })}
            options={[
              { label: EGGS, value: EGGS },
              { label: HENS, value: HENS },
            ]}
          />
          <TextField
            label={eggs ? "Crates" : "Birds"}
            type="number"
            value={form.qty}
            onChange={(v) => setForm({ ...form, qty: v })}
            placeholder="20"
          />
        </FieldRow>
        {eggs ? (
          <div className="rounded-[10px] bg-[#f6f8f5] px-3 py-2.5 text-[13.5px] text-[#4c5a51]">
            {form.otherPrice ? (
              <TextField
                label="Price per crate ₦ (admin)"
                type="number"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
              />
            ) : (
              <>
                At the crate price,{" "}
                <span className="font-semibold text-[#14231a]">
                  {S.cratePrice > 0 ? fmtN(S.cratePrice) : "not set yet"}
                </span>
                .
                {S.isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, otherPrice: true })}
                    className="ml-2 font-semibold text-[#2f8f46] underline"
                  >
                    Use another price
                  </button>
                ) : null}
              </>
            )}
            {buyer ? (
              <div className="mt-1 text-[12.5px] text-[#8b958d]">
                {buyer.name}: {buyer.alloc} crates a week
                {buyer.credit > 0 ? ` · ${fmtN(buyer.credit)} credit is applied automatically` : ""}
              </div>
            ) : null}
          </div>
        ) : (
          <FieldRow>
            <SelectField
              label="From batch"
              value={batch?.batch ?? ""}
              onChange={(v) => setForm({ ...form, batch: v })}
              options={activeBatches.map((b) => ({
                label: `${b.batch} (${(b.birds - b.mortality).toLocaleString("en-US")} birds)`,
                value: b.batch,
              }))}
            />
            <TextField
              label="Price per bird ₦"
              type="number"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
            />
          </FieldRow>
        )}
        {S.isAdmin ? (
          <label className="flex items-center gap-2 text-[13.5px] text-[#4c5a51]">
            <input
              type="checkbox"
              checked={form.paidNow}
              onChange={(e) => setForm({ ...form, paidNow: e.target.checked })}
            />
            Money received now (admin)
          </label>
        ) : null}
        {S.isAdmin && form.paidNow ? (
          <FieldRow>
            <SelectField
              label="Method"
              value={form.method}
              onChange={(v) => setForm({ ...form, method: v })}
              options={[
                { label: "Cash", value: "cash" },
                { label: "Bank transfer", value: "transfer" },
                { label: "POS", value: "pos" },
              ]}
            />
            <TextField
              label="Reference"
              value={form.reference}
              onChange={(v) => setForm({ ...form, reference: v })}
              placeholder="Receipt no."
            />
          </FieldRow>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title={payInvoice?.status === "paid" ? "Payments" : "Record payment"}
        sub={
          payInvoice
            ? `${payInvoice.name} · ${fmtN(balance(payInvoice))} outstanding of ${fmtN(payInvoice.qty * payInvoice.price)}`
            : ""
        }
        onSubmit={() => void savePayment()}
        submitLabel={payInvoice?.status === "paid" ? "Done" : "Record payment"}
      >
        {payInvoice?.status === "pending" ? (
          <>
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
            {overpay > 0 ? (
              <div className="text-[13px] text-[#4c5a51]">
                {fmtN(overpay)} over the balance is kept as {payInvoice.name}&apos;s credit.
              </div>
            ) : null}
          </>
        ) : null}
        {payHistory.length ? (
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-[#4c5a51]">Payments so far</div>
            {payHistory.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-t border-[#eef1ec] py-2 text-[13.5px]"
              >
                <span>
                  {fmtD(p.date)} · {METHOD[p.method]}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{fmtN(p.amount)}</span>
                  <button
                    type="button"
                    disabled={S.saving}
                    onClick={() => {
                      if (window.confirm(`Remove this ${fmtN(p.amount)} payment?`)) void S.deletePayment(p.id);
                    }}
                    className="text-[12px] font-semibold text-[#c7402f]"
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <FormError message={payError} />
      </Drawer>

      {cashDue.length ? (
        <Card className="mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Cash to confirm</CardTitle>
            <span className="text-[13px] text-[#8b958d]">
              {fmtN(cashDue.reduce((a, v) => a + balance(v), 0))} from walk-in sales
            </span>
          </div>
          <div className="mt-2 flex flex-col">
            {cashDue.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ec] py-2.5 text-[14px]"
              >
                <span>
                  {fmtD(v.date)} · <span className="font-semibold">{v.name}</span> · {v.qty}{" "}
                  {v.unit || "crates"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{fmtN(balance(v))}</span>
                  {S.isAdmin ? (
                    <button
                      onClick={() => openPay(v.id)}
                      disabled={S.saving}
                      className="rounded-[10px] border border-[#cfe3d3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2f8f46]"
                    >
                      Confirm cash
                    </button>
                  ) : (
                    <span className="text-[12.5px] text-[#8b958d]">awaiting an admin</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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
                      label={
                        v.status === "pending"
                          ? v.cust === null
                            ? "cash due"
                            : v.paid > 0
                              ? "part-paid"
                              : "pending"
                          : "paid"
                      }
                      bg={b.bg}
                      fg={b.fg}
                    />
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <a
                      href={`/invoices/${v.id}`}
                      target="_blank"
                      className="mr-1 rounded-md px-1.5 text-[12px] font-semibold text-[#2f8f46] opacity-70 hover:opacity-100"
                    >
                      Invoice
                    </a>
                    {/* Money is an admin's call: staff see the status only. */}
                    {S.isAdmin && (v.status === "pending" || v.paid > 0) ? (
                      <button
                        onClick={() => openPay(v.id)}
                        disabled={S.saving}
                        className="rounded-[10px] border border-[#cfe3d3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2f8f46]"
                      >
                        {v.status === "pending" ? "Record payment" : "Payments"}
                      </button>
                    ) : null}
                    {v.status === "pending" && v.paid === 0 ? (
                      <DeleteButton
                        kind="invoice"
                        id={v.id}
                        what={
                          v.orderId
                            ? "this invoice (its order goes back to pending)"
                            : v.unit === "birds"
                              ? "this invoice (the hens go back to their batch)"
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
      <div className="mt-3 flex flex-wrap gap-5 text-[13.5px] text-[#4c5a51]">
        <div>
          Owed to the farm: <span className="font-bold text-[#b57a12]">{fmtN(receivables)}</span>
        </div>
        <div>
          Collected this month: <span className="font-bold text-[#2f8f46]">{fmtN(collected)}</span>
        </div>
      </div>
      <Note>
        Crate sales to a registered buyer count against their weekly allocation and are blocked while
        they&apos;re on debt hold. Only an admin records money received; anything over a buyer&apos;s
        balance is kept as their credit and used on their next invoice.
      </Note>
    </>
  );
}
