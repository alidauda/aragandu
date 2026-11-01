"use client";

import { useState } from "react";

import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Badge, Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { batch: "", bags: "", amount: "", buyer: "", date: "" };

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
    const amount = Number(form.amount);
    if (!Number.isInteger(bags) || bags <= 0) return setError("Enter a whole number of bags.");
    if (kind === "sold") {
      if (!Number.isInteger(amount) || amount <= 0) return setError("Enter what it sold for in whole naira.");
      if (bags > inStore(batch || undefined)) return setError(`Only ${inStore(batch || undefined)} bags in store for that.`);
    }
    const r = await S.addManure({
      kind: kind!,
      batch: batch || undefined,
      bags,
      amount: kind === "sold" ? amount : 0,
      buyer: form.buyer.trim(),
      date: form.date || undefined,
    });
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
            <button
              type="button"
              onClick={() => open("sold")}
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
            >
              Record sale
            </button>
            <NewButton onClick={() => open("produced")}>Record manure</NewButton>
          </div>
        }
      />

      <Drawer
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind === "sold" ? "Record manure sale" : "Record manure"}
        sub={kind === "sold" ? "It comes off that flock's bags" : "Bags collected from a flock"}
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
              <TextField label="Total amount ₦" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="120000" />
            </FieldRow>
            <TextField label="Buyer (optional)" value={form.buyer} onChange={(v) => setForm({ ...form, buyer: v })} />
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
                <Td right>
                  <DeleteButton kind="manure" id={m.id} what={`the ${fmtD(m.date)} manure entry`} />
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
