"use client";

import { useState } from "react";

import { avgKg, broilersAlive, fmtKg } from "@/lib/erp/broilers";
import { ageOn, fmtAge, fmtD, fmtK } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, DeleteButton, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { batch: "", birds: "", kg: "", date: "" };

/** Sample weighings: how heavy each batch is getting, and how fast. */
export default function BroilerWeighing() {
  const S = useErp();
  const rows = S.broilerWeighings;
  const paged = usePaged(rows);
  const active = S.broilerBatches.filter((b) => b.st === "active");
  const batchOf = (code: string) => S.broilerBatches.find((b) => b.batch === code);
  // Gain since the batch's weighing before this one, in grams a bird a day.
  const gainSince = (w: (typeof rows)[number]) => {
    const prev = rows
      .filter((x) => x.batch === w.batch && (x.date < w.date || (x.date === w.date && x.id < w.id)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
    const days = prev ? Math.round((Date.parse(w.date) - Date.parse(prev.date)) / 86_400_000) : 0;
    return prev && days > 0 ? ((avgKg(w) - avgKg(prev)) * 1000) / days : null;
  };

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const batch = form?.batch || active[0]?.batch || "";
  const save = async () => {
    if (!form) return;
    const birds = Number(form.birds);
    const kg = Number(form.kg);
    if (!batch) return setError("Add a batch first.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the birds weighed.");
    if (!(kg > 0)) return setError("Enter their weight together, in kg.");
    const b = batchOf(batch);
    if (b && birds > broilersAlive(b, S.broilerDaily, S.broilerSales)) return setError(`${batch} doesn't have that many birds.`);
    const r = await S.addBroilerWeighing({ batch, birds, kg, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Broilers"
        title="Weighing"
        sub="Weigh a sample together; the average weight is worked out for you"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Record weighing
          </NewButton>
        }
      />

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record weighing" sub="A sample of birds weighed together" onSubmit={() => void save()} submitLabel="Record">
        {form ? (
          <>
            <SelectField label="Batch" value={batch} onChange={(v) => setForm({ ...form, batch: v })} options={active.map((b) => ({ label: b.batch, value: b.batch }))} />
            <FieldRow>
              <TextField label="Birds weighed" type="number" value={form.birds} onChange={(v) => setForm({ ...form, birds: v })} placeholder="50" />
              <TextField label="Their weight (kg)" type="number" value={form.kg} onChange={(v) => setForm({ ...form, kg: v })} placeholder="112.5" />
            </FieldRow>
            {Number(form.birds) > 0 && Number(form.kg) > 0 ? (
              <div className="-mt-1 text-[13px] text-[#465657]">
                Average <span className="font-semibold">{fmtKg(Number(form.kg) / Number(form.birds), 3)}</span> a bird
              </div>
            ) : null}
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Batch</Th>
            <Th right>Age</Th>
            <Th right>Birds weighed</Th>
            <Th right>Weight</Th>
            <Th right>Average</Th>
            <Th right>Gain a day</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={8} className="text-[#84908f]">
                  Nothing weighed yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((w) => {
              const b = batchOf(w.batch);
              const age = b ? ageOn(b, w.date) : null;
              const gain = gainSince(w);
              return (
                <TRow key={w.id}>
                  <Td>
                    {fmtD(w.date)}
                    <Recorded at={w.createdAt} date={w.date} />
                  </Td>
                  <Td className="font-semibold">{w.batch}</Td>
                  <Td right>{age === null ? "—" : fmtAge(age)}</Td>
                  <Td right>{fmtK(w.birds)}</Td>
                  <Td right>{fmtKg(w.kg, 1)}</Td>
                  <Td right className="font-semibold">
                    {fmtKg(avgKg(w), 3)}
                  </Td>
                  <Td right>{gain === null ? "—" : `${Math.round(gain)} g`}</Td>
                  <Td right>
                    <DeleteButton kind="broilerWeighing" id={w.id} what={`the ${fmtD(w.date)} ${w.batch} weighing`} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Gain a day is since the batch&apos;s previous weighing. Weigh birds from around the house, not just the nearest,
        so the average is fair. Samples can also be entered on Daily entry.
      </Note>
    </>
  );
}
