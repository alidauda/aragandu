"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK } from "@/lib/erp/derive";
import {
  Badge,
  Card,
  DeleteButton,
  Kpi,
  Note,
  PageHeader,
  Recorded,
  Table,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const REASON = {
  died: { label: "died", bg: "#fbeae7", fg: "#c7402f" },
  culled: { label: "culled", bg: "#fcf2de", fg: "#9a6a12" },
  sold: { label: "sold", bg: "#e2f0ed", fg: "#016559" },
} as const;

/** Birds out — deaths, culls and hens sold — with where they left from. */
export default function LayersMortality() {
  const S = useErp();
  const month = S.today.slice(0, 8);
  const thisMonth = S.birdOuts.filter((o) => o.date.startsWith(month));
  const sum = (rows: typeof S.birdOuts, r?: string) =>
    rows.filter((o) => !r || o.reason === r).reduce((a, o) => a + o.birds, 0);
  const active = S.batches.filter((b) => b.st === "active");
  const alive = active.reduce((a, b) => a + b.birds - b.mortality, 0);
  const rows = [...S.birdOuts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ batch: "", house: "", birds: "", reason: "died", date: "" });
  const [error, setError] = useState("");
  const batch = active.find((b) => b.batch === form.batch) ?? active[0];
  const house = batch?.placements.some((p) => p.house === form.house) ? form.house : (batch?.placements[0]?.house ?? "");

  const save = async () => {
    const n = Number(form.birds);
    if (!batch) return setError("There's no active batch.");
    if (!Number.isInteger(n) || n <= 0) return setError("Enter a whole number of birds.");
    setError("");
    const r = await S.recordMortality({
      batch: batch.batch,
      house: house || undefined,
      birds: n,
      reason: form.reason as "died",
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm({ ...form, birds: "", date: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Mortality"
        sub="Deaths, culls and hens sold — by batch and house"
        action={
          S.canDo("layers") ? (
            <NewButton
              onClick={() => {
                setError("");
                setOpen(true);
              }}
            >
              Record birds out
            </NewButton>
          ) : null
        }
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Birds out"
        sub="Deaths and culls. Spent hens sold go through Record sale."
        onSubmit={() => void save()}
        submitLabel="Record"
      >
        <FieldRow>
          <SelectField
            label="Batch"
            value={batch?.batch ?? ""}
            onChange={(v) => setForm({ ...form, batch: v, house: "" })}
            options={active.map((b) => ({ label: `${b.batch} (${fmtK(b.birds - b.mortality)} birds)`, value: b.batch }))}
          />
          {batch && batch.placements.length > 1 ? (
            <SelectField
              label="House"
              value={house}
              onChange={(v) => setForm({ ...form, house: v })}
              options={batch.placements.map((p) => ({ label: `${p.house} (${fmtK(p.birds)})`, value: p.house }))}
            />
          ) : null}
        </FieldRow>
        <FieldRow>
          <TextField
            label="Birds"
            type="number"
            value={form.birds}
            onChange={(v) => setForm({ ...form, birds: v })}
            placeholder="3"
          />
          <SelectField
            label="Why"
            value={form.reason}
            onChange={(v) => setForm({ ...form, reason: v })}
            options={[
              { label: "Died", value: "died" },
              { label: "Culled", value: "culled" },
            ]}
          />
        </FieldRow>
        <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Died · this month" value={fmtK(sum(thisMonth, "died"))} color="#c7402f" />
        <Kpi label="Culled · this month" value={fmtK(sum(thisMonth, "culled"))} color="#9a6a12" />
        <Kpi
          label="Mortality · this month"
          value={alive ? `${((100 * sum(thisMonth, "died")) / (alive + sum(thisMonth))).toFixed(2)}%` : "—"}
          sub="deaths of the birds at the start of the month"
        />
        <Kpi label="Birds now" value={fmtK(alive)} sub={`${active.length} active batch${active.length === 1 ? "" : "es"}`} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Batch</Th>
            <Th>House</Th>
            <Th>Why</Th>
            <Th right>Birds</Th>
            <Th>Recorded by</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  No birds out recorded yet.
                </Td>
              </TRow>
            ) : null}
            {rows.map((o) => (
              <TRow key={o.id}>
                <Td>
                  {fmtD(o.date)}
                  <Recorded at={o.createdAt} date={o.date} />
                </Td>
                <Td className="font-semibold">{o.batch}</Td>
                <Td>{o.house ?? "—"}</Td>
                <Td>
                  <Badge label={REASON[o.reason].label} bg={REASON[o.reason].bg} fg={REASON[o.reason].fg} />
                </Td>
                <Td right className="font-semibold">
                  {fmtK(o.birds)}
                </Td>
                <Td className="text-[#465657]">{o.by}</Td>
                <Td right>
                  {o.reason !== "sold" ? (
                    <DeleteButton kind="birdOut" id={o.id} what={`the ${fmtD(o.date)} record of ${o.birds} ${o.reason} in ${o.batch}`} />
                  ) : null}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Birds out come off the house they left, so each house&apos;s count stays right. Deleting a death or cull
        (admin) puts the birds back. Hens sold go with their invoice — delete the invoice to undo a sale.
      </Note>
    </>
  );
}
