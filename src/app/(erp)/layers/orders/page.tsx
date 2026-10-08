"use client";

import { useState } from "react";

import { shortDay } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import { blockingDebt, fmtD, fmtN, stBadge, weekUsage } from "@/lib/erp/derive";
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
  CardTitle,
  Note,
  PageHeader,
  PrimaryButton,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function LayersOrders() {
  const S = useErp();
  const debt = blockingDebt(S.invoices, S.weekStart);
  const usage = weekUsage(S.orders, S.weekStart);

  const rows = [...S.orders].sort(
    (a, b) =>
      (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) ||
      b.date.localeCompare(a.date)
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cust: String(S.customers[0]?.id ?? ""),
    crates: "",
  });

  const [orderError, setOrderError] = useState("");
  const formCust = S.customers.find((c) => c.id === +form.cust) ?? S.customers[0];

  const save = async () => {
    const crates = parseInt(form.crates, 10);
    if (!formCust) return setOrderError("Add a buyer on the Customers page first.");
    if (!crates || crates <= 0) return setOrderError("Enter a number of crates above 0.");
    setOrderError("");
    if (!(await S.addOrder({ cust: formCust.id, crates })).ok) return;
    setForm({ ...form, crates: "" });
    setOpen(false);
  };

  const [priceOpen, setPriceOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState("");

  const savePrice = async () => {
    const n = parseInt(price, 10);
    if (!n || n <= 0) return setPriceError("Enter a price above 0.");
    setPriceError("");
    const r = await S.setCratePrice(n);
    if (!r.ok) {
      setPriceError(r.error);
      return;
    }
    setPriceOpen(false);
  };

  const formLeft = formCust
    ? Math.max(0, formCust.alloc - (usage[formCust.id] || 0))
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Egg orders"
        sub={`Portal and staff orders · allocations for the week of ${shortDay(S.weekStart)}`}
        action={
          <NewButton
            onClick={() => {
              setOrderError("");
              setOpen(true);
            }}
          >
            Order for buyer
          </NewButton>
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Order on a buyer's behalf"
        sub="Same rules as the portal — allocation and the debt gate apply"
        onSubmit={save}
        submitLabel="Place order"
      >
        <SelectField
          label="Buyer"
          value={String(formCust?.id ?? "")}
          onChange={(v) => setForm({ ...form, cust: v })}
          options={S.customers.map((c) => ({ label: c.name, value: String(c.id) }))}
        />
        <FieldRow>
          <TextField
            label={`Crates (${formLeft} left this week)`}
            type="number"
            value={form.crates}
            onChange={(v) => setForm({ ...form, crates: v })}
            placeholder={String(Math.min(formLeft || 10, 20))}
          />
          <div />
        </FieldRow>
        {orderError ? <div className="text-[12.5px] text-[#b3402f]">{orderError}</div> : null}
      </Drawer>
      <Drawer
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        title="Crate price"
        sub="Applies to orders fulfilled from now on; existing invoices keep their price"
        onSubmit={() => void savePrice()}
        submitLabel="Save price"
      >
        <TextField
          label="Naira per crate"
          type="number"
          value={price}
          onChange={setPrice}
          placeholder={String(S.cratePrice)}
        />
        {priceError ? (
          <div className="text-[12.5px] text-[#b3402f]">{priceError}</div>
        ) : null}
      </Drawer>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <CardTitle>Orders</CardTitle>
          <div className="text-[12.5px] text-[#8a9070]">
            {S.cratePrice > 0 ? (
              <>Crate price: {fmtN(S.cratePrice)}</>
            ) : (
              <span className="font-semibold text-[#b3402f]">
                No crate price set — orders can&apos;t be fulfilled
              </span>
            )}
            {S.isAdmin ? (
              <button
                onClick={() => {
                  setPrice(S.cratePrice > 0 ? String(S.cratePrice) : "");
                  setPriceError("");
                  setPriceOpen(true);
                }}
                className="ml-2 font-semibold text-[#3c4d28] underline"
              >
                Change
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th right>Crates</Th>
              <Th>Weekly allocation</Th>
              <Th>Status</Th>
              <Th right />
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <TRow>
                  <Td colSpan={6} className="text-[#8a9070]">
                    No orders yet. Buyers order from the portal, or use “Order for buyer”.
                  </Td>
                </TRow>
              ) : null}
              {rows.map((o) => {
                const c = S.customers.find((c) => c.id === o.cust)!;
                const b = stBadge(o.status);
                const hold = !!debt[o.cust] && o.status === "pending";
                return (
                  <TRow key={o.id}>
                    <Td>{fmtD(o.date)}</Td>
                    <Td>
                      <span className="font-semibold">{c.name}</span>
                      {hold ? (
                        <span className="ml-2 rounded-full bg-[#fbe9e5] px-2 py-0.5 text-[11px] font-bold text-[#b3402f]">
                          Debt hold — {fmtN(debt[o.cust])}
                        </span>
                      ) : null}
                      {o.notes ? (
                        <div className="mt-0.5 text-[12px] text-[#6c7359]">“{o.notes}”</div>
                      ) : null}
                    </Td>
                    <Td right className="font-semibold">
                      {o.crates}
                    </Td>
                    <Td className="text-[#59614a]">
                      {usage[o.cust] || 0} of {c.alloc} crates used
                    </Td>
                    <Td>
                      <Badge label={o.status} bg={b.bg} fg={b.fg} />
                    </Td>
                    <Td right className="whitespace-nowrap">
                      {o.status === "pending" ? (
                        <>
                          <PrimaryButton
                            onClick={() => S.fulfilOrder(o)}
                            disabled={hold}
                          >
                            Fulfil → invoice
                          </PrimaryButton>
                          <button
                            onClick={() => S.declineOrder(o)}
                            disabled={S.saving}
                            className="ml-1.5 rounded-lg border border-[#e2c9c3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#8a5a52]"
                          >
                            Decline
                          </button>
                        </>
                      ) : null}
                    </Td>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Orders carry no money. Fulfilment creates the invoice at today&apos;s
        crate price and flips the status atomically. Customers with unpaid
        pre-week invoices are held.
      </Note>
    </>
  );
}
