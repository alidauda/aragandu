"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { ReceiptChip, StaffUpload } from "@/components/erp/Receipts";
import { receiptsOf, usePayments } from "@/components/erp/PaymentDrawer";
import { BROILER_PRODUCTS, PULLET_PRODUCT, RUMINANT_PRODUCTS } from "@/lib/erp/broilers";
import { CRACKED, EGGS, HENS, MANURE } from "@/lib/erp/products";
import { balance, crackedInStore, fmtD, fmtN, receivablesOf, stBadge } from "@/lib/erp/derive";
import {
  DayField,
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
  Recorded,
  Table,
  Td,
  Th,
  THead,
  TRow,
  usePaged,
} from "@/components/erp/ui";


export default function LayersSales() {
  const S = useErp();
  // Recording money is for money admins (Accounts, a Layers admin, the owner).
  const money = S.canDo("money", "admin");
  // Broiler sales live on Broilers → Sales.
  // Other divisions' sales live on their own pages.
  const invoices = S.invoices.filter(
    (v) => !BROILER_PRODUCTS.includes(v.product) && v.product !== PULLET_PRODUCT && !RUMINANT_PRODUCTS.includes(v.product)
  );
  const rows = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const receivables = receivablesOf(invoices);
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
    house: "",
    manureFrom: "",
    paidNow: false,
    method: "cash",
    reference: "",
    date: "",
  };
  const [form, setForm] = useState(blank);
  const activeBatches = S.batches.filter((b) => b.st === "active");
  const batch = activeBatches.find((b) => b.batch === form.batch) ?? activeBatches[0];
  // Hens from a batch in several houses: which house they came out of.
  const henHouse = batch?.placements.some((p) => p.house === form.house) ? form.house : (batch?.placements[0]?.house ?? "");
  const buyer = S.customers.find((c) => c.id === +form.cust);
  const eggs = form.product === EGGS;
  const hens = form.product === HENS;
  // Manure in store by where it came from (a flock, or the reserve), and cracked eggs kept for sale.
  const manureLeft = (batch?: string) =>
    S.manure.filter((m) => m.batch === batch).reduce((a, m) => a + (m.kind === "sold" ? -m.bags : m.bags), 0);
  const manureSources = [...new Set(S.manure.map((m) => m.batch ?? ""))]
    .filter((b) => manureLeft(b || undefined) > 0)
    .map((b) => ({ label: `${b || "Reserve"} (${manureLeft(b || undefined)} bags)`, value: b }));
  const manureFrom = manureSources.some((x) => x.value === form.manureFrom) ? form.manureFrom : (manureSources[0]?.value ?? "");
  const crackedCrates = Math.floor(Math.max(0, crackedInStore(S.prodLog, S.invoices, S.eggsPerCrate, S.eggMoves)) / S.eggsPerCrate);
  const unitWord = eggs || form.product === CRACKED ? "crate" : form.product === MANURE ? "bag" : "bird";

  const save = async () => {
    const qty = Number(form.qty);
    const cust = form.cust === "walk-in" ? null : +form.cust;
    if (cust === null && !form.walkIn.trim()) return setError("Enter the walk-in buyer's name.");
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number above 0.");
    const price = form.price.trim() ? Number(form.price) : undefined;
    if (!eggs && !(price && price > 0)) return setError(`Enter the price per ${unitWord}.`);
    if (eggs && form.otherPrice && !(price && price > 0)) return setError("Enter the price per crate.");
    if (hens && !batch) return setError("There's no active batch to sell hens from.");
    if (form.product === MANURE && qty > manureLeft(manureFrom || undefined)) {
      return setError(`Only ${manureLeft(manureFrom || undefined)} bags of manure in store there.`);
    }
    if (form.product === CRACKED && qty > crackedCrates) return setError(`Only ${crackedCrates} crates of cracked eggs in store.`);
    setError("");
    const r = await S.addInvoice({
      cust,
      walkIn: form.walkIn.trim(),
      product: form.product as typeof EGGS,
      qty,
      price: eggs ? (form.otherPrice ? price : undefined) : price,
      batch: hens ? batch!.batch : undefined,
      house: hens ? henHouse || undefined : undefined,
      manureFrom: form.product === MANURE ? manureFrom : undefined,
      paid: form.paidNow
        ? { method: form.method as "cash", reference: form.reference.trim() }
        : undefined,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setOpen(false);
  };

  // ── Payments (admin)
  const pay = usePayments();

  const paged = usePaged(rows);
  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Sales & invoices"
        sub="Crates, cracked eggs, manure and spent hens, payments and what's owed"
        action={
          S.canDo("eggsales") ? (
            <NewButton
              onClick={() => {
                setForm(blank);
                setError("");
                setOpen(true);
              }}
            >
              Record sale
            </NewButton>
          ) : null
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
            ...S.customers.filter((c) => !c.archived).map((c) => ({ label: c.name, value: String(c.id) })),
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
              { label: MANURE, value: MANURE },
              { label: CRACKED, value: CRACKED },
            ]}
          />
          <TextField
            label={eggs || form.product === CRACKED ? "Crates" : form.product === MANURE ? "Bags" : "Birds"}
            type="number"
            value={form.qty}
            onChange={(v) => setForm({ ...form, qty: v })}
            placeholder="20"
          />
        </FieldRow>
        {eggs ? (
          <div className="rounded-[10px] bg-[#f2f6f5] px-3 py-2.5 text-[13.5px] text-[#465657]">
            {form.otherPrice ? (
              <TextField
                label="Price per crate ₦ (admin)"
                type="number"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
              />
            ) : (
              <>
                {buyer?.price ? `At ${buyer.name}'s own price, ` : "At the crate price, "}
                <span className="font-semibold text-[#0d1d1d]">
                  {(buyer?.price ?? S.cratePrice) > 0 ? fmtN(buyer?.price ?? S.cratePrice) : "not set yet"}
                </span>
                .
                {S.isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, otherPrice: true })}
                    className="ml-2 font-semibold text-[#055a5b] underline"
                  >
                    Use another price
                  </button>
                ) : null}
              </>
            )}
            {buyer ? (
              <div className="mt-1 text-[12.5px] text-[#84908f]">
                {buyer.name}: {buyer.alloc} crates a week
                {buyer.credit > 0 ? ` · ${fmtN(buyer.credit)} credit is applied automatically` : ""}
              </div>
            ) : null}
          </div>
        ) : form.product === MANURE ? (
          <FieldRow>
            <SelectField
              label="From"
              value={manureFrom}
              onChange={(v) => setForm({ ...form, manureFrom: v })}
              options={manureSources.length ? manureSources : [{ label: "No manure in store", value: "" }]}
            />
            <TextField label="Price per bag ₦" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          </FieldRow>
        ) : form.product === CRACKED ? (
          <FieldRow>
            <div className="self-end pb-2.5 text-[13.5px] text-[#465657]">
              <span className="font-semibold">{crackedCrates}</span> crates of cracked eggs in store
            </div>
            <TextField label="Price per crate ₦" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          </FieldRow>
        ) : (
          <FieldRow>
            <SelectField
              label="From batch"
              value={batch?.batch ?? ""}
              onChange={(v) => setForm({ ...form, batch: v, house: "" })}
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
        {hens && batch && batch.placements.length > 1 ? (
          <SelectField
            label="From house"
            value={henHouse}
            onChange={(v) => setForm({ ...form, house: v })}
            options={batch.placements.map((p) => ({ label: `${p.house} (${p.birds.toLocaleString("en-US")} birds)`, value: p.house }))}
          />
        ) : null}
        <DayField label="Sale date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        {money ? (
          <label className="flex items-center gap-2 text-[13.5px] text-[#465657]">
            <input
              type="checkbox"
              checked={form.paidNow}
              onChange={(e) => setForm({ ...form, paidNow: e.target.checked })}
            />
            Money received now (admin)
          </label>
        ) : null}
        {money && form.paidNow ? (
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

      {pay.drawer}

      {cashDue.length ? (
        <Card className="mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Cash to confirm</CardTitle>
            <span className="text-[13px] text-[#84908f]">
              {fmtN(cashDue.reduce((a, v) => a + balance(v), 0))} from walk-in sales
            </span>
          </div>
          <div className="mt-2 flex flex-col">
            {cashDue.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ebf0ef] py-2.5 text-[14px]"
              >
                <span>
                  {fmtD(v.date)} · <span className="font-semibold">{v.name}</span> · {v.qty}{" "}
                  {v.unit || "crates"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{fmtN(balance(v))}</span>
                  {money ? (
                    <button
                      onClick={() => pay.open(v.id)}
                      disabled={S.saving}
                      className="rounded-[10px] border border-[#c5dcd9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
                    >
                      Confirm cash
                    </button>
                  ) : (
                    <span className="text-[12.5px] text-[#84908f]">awaiting an admin</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
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
            {paged.rows.map((v) => {
              const b = stBadge(v.status);
              return (
                <TRow key={v.id}>
                  <Td>
                    {fmtD(v.date)}
                    <Recorded at={v.createdAt} date={v.date} />
                  </Td>
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
                    {/* Receipts for this invoice, or for the order it came from. */}
                    <ReceiptChip proofs={receiptsOf(S.proofs, v)} />
                    {/* Walk-in buyers have no account, so the seller uploads their receipt. */}
                    {v.status === "pending" ? (
                      <div className="mt-0.5">
                        <StaffUpload kind="invoice" id={v.id} due={balance(v)} product={v.product} />
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
                    {/* Money is an admin's call: staff see the status only. */}
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
                      what={`this invoice${v.paid > 0 ? ` and its ${fmtN(v.paid)} of payments` : ""}${
                        v.orderId
                          ? " (its order goes back to pending)"
                          : v.unit === "birds"
                            ? " (the hens go back to their batch)"
                            : ""
                      }`}
                    />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <div className="mt-3 flex flex-wrap gap-5 text-[13.5px] text-[#465657]">
        <div>
          Owed to the farm: <span className="font-bold text-[#b57a12]">{fmtN(receivables)}</span>
        </div>
        <div>
          Collected this month: <span className="font-bold text-[#055a5b]">{fmtN(collected)}</span>
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
