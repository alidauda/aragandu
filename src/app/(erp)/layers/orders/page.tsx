"use client";

import { useState } from "react";

import { shortDay } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import { blockingDebt, eggStock, fmtD, fmtN, stBadge, weekUsage } from "@/lib/erp/derive";
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

  const stock = eggStock(S.eggMoves, S.invoices);

  // Fulfil all of an order or part of it (the rest stays pending).
  const [fulfilFor, setFulfilFor] = useState<number | null>(null);
  const [fulfilQty, setFulfilQty] = useState("");
  const [fulfilError, setFulfilError] = useState("");
  const fulfilOrder = S.orders.find((o) => o.id === fulfilFor);
  const saveFulfil = async () => {
    if (!fulfilOrder) return;
    const n = Number(fulfilQty);
    if (!Number.isInteger(n) || n < 1 || n > fulfilOrder.crates) {
      return setFulfilError(`Enter between 1 and ${fulfilOrder.crates} crates.`);
    }
    setFulfilError("");
    const r = await S.fulfilOrder(fulfilOrder, n === fulfilOrder.crates ? undefined : n);
    if (!r.ok) return setFulfilError(r.error);
    setFulfilFor(null);
  };

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
        {orderError ? <div className="text-[12.5px] text-[#c7402f]">{orderError}</div> : null}
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
          <div className="text-[12.5px] text-[#c7402f]">{priceError}</div>
        ) : null}
      </Drawer>
      <Drawer
        open={fulfilFor !== null}
        onClose={() => setFulfilFor(null)}
        title="Fulfil order"
        sub={
          fulfilOrder
            ? `${S.customers.find((c) => c.id === fulfilOrder.cust)?.name} ordered ${fulfilOrder.crates} crates at ${
                fulfilOrder.price ? fmtN(fulfilOrder.price) : "the crate price"
              } · ${stock} in store`
            : ""
        }
        onSubmit={() => void saveFulfil()}
        submitLabel="Fulfil → invoice"
      >
        <TextField label="Crates to send" type="number" value={fulfilQty} onChange={setFulfilQty} />
        {fulfilOrder && Number(fulfilQty) > 0 && Number(fulfilQty) < fulfilOrder.crates ? (
          <div className="text-[13px] text-[#4c5a51]">
            The other {fulfilOrder.crates - Number(fulfilQty)} crates stay pending as their own order.
          </div>
        ) : null}
        <FormError message={fulfilError} />
      </Drawer>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <CardTitle>Orders</CardTitle>
          <div className="text-[12.5px] text-[#8b958d]">
            {S.cratePrice > 0 ? (
              <>Crate price: {fmtN(S.cratePrice)}</>
            ) : (
              <span className="font-semibold text-[#c7402f]">
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
                className="ml-2 font-semibold text-[#2f8f46] underline"
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
              <Th right>Price</Th>
              <Th>Weekly allocation</Th>
              <Th>Status</Th>
              <Th right />
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <TRow>
                  <Td colSpan={7} className="text-[#8b958d]">
                    No orders yet. Buyers order from the portal, or use “Order for buyer”.
                  </Td>
                </TRow>
              ) : null}
              {rows.map((o) => {
                const c = S.customers.find((c) => c.id === o.cust)!;
                // An order from an earlier week counted against that week: it can only be declined.
                const expired = o.status === "pending" && o.date < S.weekStart;
                const b = stBadge(expired ? "expired" : o.status);
                const hold = !!debt[o.cust] && o.status === "pending";
                return (
                  <TRow key={o.id}>
                    <Td>{fmtD(o.date)}</Td>
                    <Td>
                      <span className="font-semibold">{c.name}</span>
                      {hold ? (
                        <span className="ml-2 rounded-full bg-[#fbeae7] px-2 py-0.5 text-[11px] font-bold text-[#c7402f]">
                          Debt hold — {fmtN(debt[o.cust])}
                        </span>
                      ) : null}
                      {o.notes ? (
                        <div className="mt-0.5 max-w-[340px] whitespace-normal text-[12.5px] text-[#647067]">“{o.notes}”</div>
                      ) : null}
                    </Td>
                    <Td right className="font-semibold">
                      {o.crates}
                    </Td>
                    <Td right className="text-[#4c5a51]">{o.price ? fmtN(o.price) : "—"}</Td>
                    <Td className="text-[#4c5a51]">
                      {usage[o.cust] || 0} of {c.alloc} crates used
                    </Td>
                    <Td>
                      <Badge label={expired ? "expired" : o.status} bg={b.bg} fg={b.fg} />
                      {o.status === "fulfilled" ? (
                        <div className="mt-1 text-[12px] text-[#8b958d]">
                          {o.deliveredAt ? "Buyer confirmed receipt" : "Not confirmed by buyer"}
                        </div>
                      ) : null}
                    </Td>
                    <Td right className="whitespace-nowrap">
                      {o.status === "pending" ? (
                        <>
                          {expired ? null : (
                            <PrimaryButton
                              onClick={() => {
                                setFulfilFor(o.id);
                                setFulfilQty(String(Math.min(o.crates, Math.max(stock, 0)) || o.crates));
                                setFulfilError("");
                              }}
                              disabled={hold}
                            >
                              Fulfil → invoice
                            </PrimaryButton>
                          )}
                          <button
                            onClick={() => S.declineOrder(o)}
                            disabled={S.saving}
                            className="ml-1.5 rounded-lg border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a]"
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
        Each order keeps the crate price from when it was placed. Fulfilling creates the invoice
        (part of an order can be fulfilled; the rest stays pending). Orders not fulfilled by the
        end of their week expire. Buyers with unpaid invoices from earlier weeks are held.
      </Note>
    </>
  );
}
