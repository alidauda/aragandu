"use client";

import Link from "next/link";
import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { balance, fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import { invNo } from "@/lib/orders";
import { CustomerTabs } from "@/components/erp/CustomerTabs";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
import { Badge, Card, CardTitle, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow } from "@/components/erp/ui";

const EGGS = "Eggs (crates)";
const WALK_IN = / \(walk-in\)$/;

/**
 * Local buyers who aren't on the register: sell to them by name, see what
 * each has bought, and add a regular to the register when they become one.
 */
export default function WalkInBuyers() {
  const S = useErp();
  const money = S.canDo("money", "admin");
  const sells = S.canDo("eggsales");
  const month = S.today.slice(0, 8);

  const sales = S.invoices.filter((v) => v.cust === null);
  const nameOf = (v: { name: string }) => v.name.replace(WALK_IN, "");
  const thisMonth = sales.filter((v) => v.date.startsWith(month));

  // One row per walk-in name, most recent first.
  const buyers = [...new Set(sales.map(nameOf))]
    .map((name) => {
      const mine = sales.filter((v) => nameOf(v) === name);
      return {
        name,
        purchases: mine.length,
        crates: mine.filter((v) => v.product === EGGS).reduce((a, v) => a + v.qty, 0),
        total: mine.reduce((a, v) => a + v.qty * v.price, 0),
        unpaid: mine.reduce((a, v) => a + Math.max(0, balance(v)), 0),
        last: mine.reduce((a, v) => (v.date > a ? v.date : a), ""),
      };
    })
    .sort((a, b) => b.last.localeCompare(a.last) || a.name.localeCompare(b.name));
  const registered = new Set(S.customers.map((c) => c.name.trim().toLowerCase()));

  // ── Sell
  const blank = { name: "", qty: "", price: "", paidNow: false, method: "cash", reference: "", date: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const startSale = (name = "") => {
    setForm({ ...blank, name });
    setError("");
    setOpen(true);
  };
  const qty = Number(form.qty);
  const unit = S.isAdmin && form.price.trim() ? Number(form.price) : S.cratePrice;

  const sell = async () => {
    if (!form.name.trim()) return setError("Enter the buyer's name.");
    if (!Number.isInteger(qty) || qty <= 0) return setError("Enter a whole number of crates.");
    if (S.isAdmin && form.price.trim() && !(Number(form.price) > 0)) return setError("Enter the price per crate.");
    if (!unit) return setError("Set the crate price first (Egg orders → crate price).");
    setError("");
    const r = await S.addInvoice({
      cust: null,
      walkIn: form.name.trim(),
      product: EGGS,
      qty,
      price: S.isAdmin && form.price.trim() ? Number(form.price) : undefined,
      paid: money && form.paidNow ? { method: form.method as "cash", reference: form.reference.trim() } : undefined,
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setOpen(false);
    setMsg(
      `Sold ${qty} crate${qty === 1 ? "" : "s"} to ${form.name.trim()}${
        money && form.paidNow ? "" : " — the money waits on Sales & invoices until an admin confirms it"
      }.`
    );
  };

  // ── Add a regular to the register
  const [promote, setPromote] = useState<{ name: string; phone: string; alloc: string } | null>(null);
  const [promoteError, setPromoteError] = useState("");
  const savePromote = async () => {
    if (!promote) return;
    const alloc = promote.alloc.trim() ? Number(promote.alloc) : 0;
    if (!Number.isInteger(alloc) || alloc < 0) return setPromoteError("Weekly crates is a whole number.");
    setPromoteError("");
    const r = await S.addCustomer({ name: promote.name.trim(), phone: promote.phone.trim(), alloc, email: "" });
    if (!r.ok) return setPromoteError(r.error);
    setMsg(`${promote.name.trim()} is now on the register — find them under Registered buyers.`);
    setPromote(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Customers"
        sub="Local buyers who aren't on the register — sell to them by name"
        action={sells ? <NewButton onClick={() => startSale()}>Sell to walk-in</NewButton> : null}
      />
      <CustomerTabs />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Sell to a walk-in buyer"
        sub="Crates sold at the gate — no account needed"
        onSubmit={() => void sell()}
        submitLabel="Record sale"
      >
        <TextField
          label="Buyer's name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Mama Tolu"
          list="walk-in-names"
        />
        <datalist id="walk-in-names">
          {buyers.map((b) => (
            <option key={b.name} value={b.name} />
          ))}
        </datalist>
        <FieldRow>
          <TextField
            label="Crates"
            type="number"
            value={form.qty}
            onChange={(v) => setForm({ ...form, qty: v })}
            placeholder="2"
          />
          {S.isAdmin ? (
            <TextField
              label="Price per crate ₦"
              type="number"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              placeholder={String(S.cratePrice || "")}
            />
          ) : null}
        </FieldRow>
        {qty > 0 && unit ? (
          <div className="text-[14px] text-[#465657]">
            Total <span className="font-semibold text-[#0d1d1d]">{fmtN(qty * unit)}</span> at {fmtN(unit)} a crate
          </div>
        ) : null}
        <DayField label="Sale date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        {money ? (
          <>
            <label className="flex items-center gap-2 text-[13.5px] text-[#465657]">
              <input
                type="checkbox"
                checked={form.paidNow}
                onChange={(e) => setForm({ ...form, paidNow: e.target.checked })}
              />
              Money received now
            </label>
            {form.paidNow ? (
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
                  label="Reference (optional)"
                  value={form.reference}
                  onChange={(v) => setForm({ ...form, reference: v })}
                />
              </FieldRow>
            ) : null}
          </>
        ) : (
          <div className="text-[12.5px] text-[#84908f]">
            The money waits on Sales &amp; invoices until an admin confirms it.
          </div>
        )}
        <FormError message={error} />
      </Drawer>

      <Drawer
        open={promote !== null}
        onClose={() => setPromote(null)}
        title="Add to the register"
        sub="For a regular: a buyer record with allocation, credit and a portal login. Past walk-in sales stay as they are."
        onSubmit={() => void savePromote()}
        submitLabel="Add buyer"
      >
        {promote ? (
          <>
            <TextField label="Name" value={promote.name} onChange={(v) => setPromote({ ...promote, name: v })} />
            <FieldRow>
              <TextField
                label="Phone"
                value={promote.phone}
                onChange={(v) => setPromote({ ...promote, phone: v })}
                placeholder="0803 000 0000"
              />
              <TextField
                label="Weekly crates"
                type="number"
                value={promote.alloc}
                onChange={(v) => setPromote({ ...promote, alloc: v })}
                placeholder="0"
              />
            </FieldRow>
            <FormError message={promoteError} />
          </>
        ) : null}
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="Walk-in sales · this month"
          value={fmtN(thisMonth.reduce((a, v) => a + v.qty * v.price, 0))}
          sub={`${thisMonth.length} sale${thisMonth.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Crates · this month"
          value={fmtK(thisMonth.filter((v) => v.product === EGGS).reduce((a, v) => a + v.qty, 0))}
          color="#3a8bd6"
        />
        <Kpi
          label="Buyers · this month"
          value={String(new Set(thisMonth.map(nameOf)).size)}
          sub={`${buyers.length} walk-in buyer${buyers.length === 1 ? "" : "s"} in all`}
        />
        <Kpi
          label="Money to confirm"
          value={fmtN(sales.reduce((a, v) => a + Math.max(0, balance(v)), 0))}
          sub="walk-in sales not marked paid"
          color="#9a6a12"
        />
      </div>

      {msg ? <p className="mb-4 rounded-xl bg-[#e2f0ed] px-4 py-2.5 text-[13.5px] text-[#016559]">{msg}</p> : null}

      <Card className="mb-4 overflow-hidden">
        <div className="px-5 pt-4">
          <CardTitle>Walk-in buyers</CardTitle>
        </div>
        <Table>
          <THead>
            <Th>Buyer</Th>
            <Th right>Purchases</Th>
            <Th right>Crates</Th>
            <Th right>Total</Th>
            <Th right>Not yet paid</Th>
            <Th>Last bought</Th>
            <Th right />
          </THead>
          <tbody>
            {buyers.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  No walk-in sales yet.
                </Td>
              </TRow>
            ) : null}
            {buyers.map((b) => (
              <TRow key={b.name}>
                <Td className="font-semibold">{b.name}</Td>
                <Td right>{b.purchases}</Td>
                <Td right>{fmtK(b.crates)}</Td>
                <Td right>{fmtN(b.total)}</Td>
                <Td right>
                  <span style={{ color: b.unpaid ? "#9a6a12" : "#84908f" }}>{b.unpaid ? fmtN(b.unpaid) : "—"}</span>
                </Td>
                <Td>{fmtD(b.last)}</Td>
                <Td right className="whitespace-nowrap">
                  {sells ? (
                    <>
                      <button
                        onClick={() => startSale(b.name)}
                        className="rounded-lg border border-[#d6dfde] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#055a5b]"
                      >
                        Sell again
                      </button>
                      {registered.has(b.name.trim().toLowerCase()) ? (
                        <span className="ml-2 text-[12px] text-[#84908f]">on the register</span>
                      ) : (
                        <button
                          onClick={() => {
                            setPromote({ name: b.name, phone: "", alloc: "" });
                            setPromoteError("");
                          }}
                          className="ml-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#055a5b] opacity-80 hover:opacity-100"
                        >
                          Add to register
                        </button>
                      )}
                    </>
                  ) : null}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-4">
          <CardTitle>Recent walk-in sales</CardTitle>
        </div>
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Invoice</Th>
            <Th>Buyer</Th>
            <Th>Item</Th>
            <Th right>Qty</Th>
            <Th right>Amount</Th>
            <Th>Status</Th>
          </THead>
          <tbody>
            {sales.slice(0, 30).map((v) => (
              <TRow key={v.id}>
                <Td>
                  {fmtD(v.date)}
                  <Recorded at={v.createdAt} date={v.date} />
                </Td>
                <Td>
                  <Link href={`/invoices/${v.id}`} className="font-medium text-[#055a5b] hover:underline">
                    {invNo(v.id)}
                  </Link>
                </Td>
                <Td className="font-semibold">{nameOf(v)}</Td>
                <Td className="text-[#465657]">{v.product}</Td>
                <Td right>{v.qty}</Td>
                <Td right>{fmtN(v.qty * v.price)}</Td>
                <Td>
                  <Badge
                    label={v.status === "paid" ? "paid" : "to confirm"}
                    bg={v.status === "paid" ? "#e2f0ed" : "#fcf2de"}
                    fg={v.status === "paid" ? "#016559" : "#9a6a12"}
                  />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Walk-in buyers pay on the spot and can&apos;t hold credit or order ahead. Someone who buys every week is
        better on the register: they get a weekly allocation, can pay ahead and order from the portal.
      </Note>
    </>
  );
}
