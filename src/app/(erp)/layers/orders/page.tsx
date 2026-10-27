"use client";

import { useState } from "react";

import { shortDay } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import { ReceiptChip, ReceiptList, proofsFor, StaffUpload } from "@/components/erp/Receipts";
import { blockingDebt, eggStock, fmtD, fmtN, stBadge, weekUsage } from "@/lib/erp/derive";
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
  Note,
  PageHeader,
  PrimaryButton,
  Recorded,
  Table,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/erp/ui";

export default function LayersOrders() {
  const S = useErp();
  // Recording money is for money admins (Accounts, a Layers admin, the owner).
  const money = S.canDo("money", "admin");
  // Taking, fulfilling and declining orders is egg-sales work (not Accounts).
  const work = S.canDo("eggsales");
  const debt = blockingDebt(S.invoices, S.weekStart);
  const usage = weekUsage(S.orders, S.weekStart);

  // Paid orders to fulfil first, then ones awaiting payment, then the rest.
  const rank = (o: (typeof S.orders)[number]) => (o.status !== "pending" ? 2 : o.paidAt ? 0 : 1);
  const rows = [...S.orders].sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date) || b.id - a.id);
  const payByTime = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit" });

  // Admin: the buyer paid for an order by transfer, cash or POS.
  const [payFor, setPayFor] = useState<number | null>(null);
  const [pay, setPay] = useState({ method: "transfer", reference: "", date: "" });
  const [payError, setPayError] = useState("");
  const payOrder = S.orders.find((o) => o.id === payFor);
  const savePaid = async () => {
    if (!payOrder) return;
    setPayError("");
    const r = await S.markOrderPaid({
      orderId: payOrder.id,
      method: pay.method as "transfer",
      reference: pay.reference.trim(),
      date: pay.date || undefined,
    });
    if (!r.ok) return setPayError(r.error);
    setPayFor(null);
  };

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
    cust: String(S.customers.find((c) => !c.archived)?.id ?? ""),
    crates: "",
  });

  const [orderError, setOrderError] = useState("");
  const active = S.customers.filter((c) => !c.archived);
  const formCust = active.find((c) => c.id === +form.cust) ?? active[0];

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
          work ? (
            <NewButton
              onClick={() => {
                setOrderError("");
                setOpen(true);
              }}
            >
              Order for buyer
            </NewButton>
          ) : null
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Order on a buyer's behalf"
        sub="Same rules as the portal. It's emailed to the buyer to pay — it reaches the queue once paid"
        onSubmit={save}
        submitLabel="Place order"
      >
        <SelectField
          label="Buyer"
          value={String(formCust?.id ?? "")}
          onChange={(v) => setForm({ ...form, cust: v })}
          options={S.customers.filter((c) => !c.archived).map((c) => ({ label: c.name, value: String(c.id) }))}
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
        {formCust && (formCust.price ?? S.cratePrice) > 0 ? (
          <div className="text-[13px] text-[#465657]">
            {formCust.price ? `${formCust.name}'s own price` : "Crate price"}:{" "}
            <span className="font-semibold">{fmtN(formCust.price ?? S.cratePrice)}</span>
            {Number(form.crates) > 0 ? ` · total ${fmtN(Number(form.crates) * (formCust.price ?? S.cratePrice))}` : ""}
          </div>
        ) : null}
        {orderError ? <div className="text-[12.5px] text-[#c7402f]">{orderError}</div> : null}
      </Drawer>
      <Drawer
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        title="Crate price"
        sub="The farm price, for new orders and sales. Buyers with their own price (Customers → Edit) keep theirs; orders already placed keep theirs"
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
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title="Mark order paid"
        sub={
          payOrder
            ? `${S.customers.find((c) => c.id === payOrder.cust)?.name} — ${payOrder.crates} crates × ${fmtN(
                payOrder.price ?? 0
              )} = ${fmtN(payOrder.crates * (payOrder.price ?? 0))}. Any free credit they have is used first.`
            : ""
        }
        onSubmit={() => void savePaid()}
        submitLabel="Mark paid"
      >
        <FieldRow>
          <SelectField
            label="Paid by"
            value={pay.method}
            onChange={(v) => setPay({ ...pay, method: v })}
            options={[
              { label: "Bank transfer", value: "transfer" },
              { label: "Cash", value: "cash" },
              { label: "POS", value: "pos" },
            ]}
          />
          <TextField
            label="Reference (optional)"
            value={pay.reference}
            onChange={(v) => setPay({ ...pay, reference: v })}
            placeholder="Bank ref"
          />
        </FieldRow>
        <DayField label="Received on" value={pay.date} onChange={(v) => setPay({ ...pay, date: v })} />
        {payOrder ? <ReceiptList proofs={proofsFor(S.proofs, { orderId: payOrder.id })} /> : null}
        <div className="text-[12.5px] text-[#5d6b6b]">
          Only mark it paid once the money is in the farm&apos;s account. The order then goes to the queue.
        </div>
        <FormError message={payError} />
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
          <div className="text-[13px] text-[#465657]">
            The other {fulfilOrder.crates - Number(fulfilQty)} crates stay pending as their own order.
          </div>
        ) : null}
        <FormError message={fulfilError} />
      </Drawer>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <CardTitle>Orders</CardTitle>
          <div className="text-[12.5px] text-[#84908f]">
            {S.cratePrice > 0 ? (
              <>
                Crate price: {fmtN(S.cratePrice)}
                {S.customers.some((c) => c.price && !c.archived)
                  ? ` · ${S.customers.filter((c) => c.price && !c.archived).length} buyer(s) on their own price`
                  : ""}
              </>
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
                className="ml-2 font-semibold text-[#055a5b] underline"
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
                  <Td colSpan={7} className="text-[#84908f]">
                    No orders yet. Buyers order from the portal, or use “Order for buyer”.
                  </Td>
                </TRow>
              ) : null}
              {rows.map((o) => {
                const c = S.customers.find((c) => c.id === o.cust)!;
                const paid = o.status === "pending" && !!o.paidAt;
                const awaiting = o.status === "pending" && !o.paidAt;
                const b = stBadge(o.status);
                const hold = !!debt[o.cust] && awaiting;
                return (
                  <TRow key={o.id}>
                    <Td>
                      {fmtD(o.date)}
                      <Recorded at={o.createdAt} date={o.date} verb="placed" />
                    </Td>
                    <Td>
                      <span className="font-semibold">{c.name}</span>
                      {hold ? (
                        <span className="ml-2 rounded-full bg-[#fbeae7] px-2 py-0.5 text-[11px] font-bold text-[#c7402f]">
                          Debt hold — {fmtN(debt[o.cust])}
                        </span>
                      ) : null}
                      {o.notes ? (
                        <div className="mt-0.5 max-w-[340px] whitespace-normal text-[12.5px] text-[#5d6b6b]">“{o.notes}”</div>
                      ) : null}
                    </Td>
                    <Td right className="font-semibold">
                      {o.crates}
                    </Td>
                    <Td right className="text-[#465657]">{o.price ? fmtN(o.price) : "—"}</Td>
                    <Td className="text-[#465657]">
                      {usage[o.cust] || 0} of {c.alloc} crates used
                    </Td>
                    <Td>
                      {paid ? (
                        <Badge label="paid · to fulfil" bg="#e8f1fb" fg="#2f6fb3" />
                      ) : awaiting ? (
                        <>
                          <Badge label="awaiting payment" bg="#fcf2de" fg="#9a6a12" />
                          {o.payBy ? (
                            <div className="mt-1 text-[12px] text-[#84908f]">released {payByTime(o.payBy)} if unpaid</div>
                          ) : null}
                          <div className="mt-0.5">
                            <StaffUpload kind="order" id={o.id} due={o.crates * (o.price ?? 0)} customerId={o.cust} />
                          </div>
                        </>
                      ) : (
                        <Badge label={o.status} bg={b.bg} fg={b.fg} />
                      )}
                      {o.status === "declined" && o.declineReason ? (
                        <div className="mt-1 text-[12px] text-[#84908f]">{o.declineReason}</div>
                      ) : null}
                      {/* The buyer's receipt stays one click away, paid or not. */}
                      <ReceiptChip proofs={proofsFor(S.proofs, { orderId: o.id })} />
                      {o.status === "fulfilled" ? (
                        <div className="mt-1 text-[12px] text-[#84908f]">
                          {o.deliveredAt ? "Buyer confirmed receipt" : "Not confirmed by buyer"}
                        </div>
                      ) : null}
                    </Td>
                    <Td right className="whitespace-nowrap">
                      {o.status === "pending" ? (
                        <>
                          {paid && work ? (
                            <PrimaryButton
                              onClick={() => {
                                setFulfilFor(o.id);
                                setFulfilQty(String(Math.min(o.crates, Math.max(stock, 0)) || o.crates));
                                setFulfilError("");
                              }}
                            >
                              Fulfil → invoice
                            </PrimaryButton>
                          ) : !paid && money ? (
                            <button
                              onClick={() => {
                                setPayFor(o.id);
                                // Several transfers: all their references.
                                const refs = proofsFor(S.proofs, { orderId: o.id })
                                  .filter((p) => p.status === "submitted" && p.reference)
                                  .map((p) => p.reference)
                                  .reverse();
                                setPay({ method: "transfer", reference: refs.join(", ").slice(0, 200), date: "" });
                                setPayError("");
                              }}
                              disabled={S.saving}
                              className="rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
                            >
                              Mark paid
                            </button>
                          ) : null}
                          {work ? (
                            <button
                              onClick={() => {
                                const q = paid
                                  ? `Decline this paid order? The buyer's ${fmtN(o.crates * (o.price ?? 0))} stays as their credit (refund it from Customers if they ask).`
                                  : "Decline this unpaid order? Its crates go back on the buyer's allocation.";
                                if (window.confirm(q)) void S.declineOrder(o);
                              }}
                              disabled={S.saving}
                              className="ml-1.5 rounded-lg border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a]"
                            >
                              Decline
                            </button>
                          ) : null}
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
        Orders are paid up front: a buyer pays when they order (online, or from their credit), and
        only paid orders can be fulfilled. Unpaid orders hold their crates for 24 hours and are then
        released. Fulfilling raises the invoice, settled from what they paid; part of an order can be
        fulfilled and the rest stays paid and pending. Declining a paid order keeps the money as the
        buyer&apos;s credit. Each order keeps the crate price from when it was placed.
      </Note>
    </>
  );
}
