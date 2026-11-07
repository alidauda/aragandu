"use client";

import { useState } from "react";

import { broilersAlive, fmtKg } from "@/lib/erp/broilers";
import { ageOn, fmtAge, fmtD, fmtK } from "@/lib/erp/derive";
import { useBirdUnit } from "@/components/erp/useUnit";
import { Card, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { batch: "", birds: "", kg: "", code: "", house: "", date: "" };

/** Brooding birds sent to Layers: each dispatch starts a new Layers flock, keeping the birds' age. */
export default function BroodingDispatch() {
  const S = useBirdUnit();
  const rows = S.broodingDispatches;
  const paged = usePaged(rows);
  const active = S.broilerBatches.filter((b) => b.st === "active");
  const batchOf = (code: string) => S.broilerBatches.find((b) => b.batch === code);
  const alive = (code: string) => {
    const b = batchOf(code);
    return b ? broilersAlive(b, S) : 0;
  };
  const month = S.today.slice(0, 7);
  const sentMonth = rows.filter((x) => x.date.slice(0, 7) === month).reduce((a, x) => a + x.birds, 0);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const batch = form?.batch || active[0]?.batch || "";
  const house = form?.house || S.houses[0]?.code || "";
  const b = batchOf(batch);
  const ageThen = b ? ageOn(b, form?.date || S.today) : null;
  const save = async () => {
    if (!form) return;
    const birds = Number(form.birds);
    const kg = Number(form.kg || 0);
    if (!batch) return setError("There's no brooding batch to send.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the birds sent.");
    if (birds > alive(batch)) return setError(`${batch} only has ${fmtK(alive(batch))} birds.`);
    if (kg < 0) return setError("The weight can't be negative.");
    if (!form.code.trim()) return setError("Enter the new Layers batch number, e.g. Focus 20.");
    if (!house) return setError("Add a Layers hall first.");
    const r = await S.dispatchToLayers({ batch, birds, kg, code: form.code.trim().toUpperCase(), house, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Brooding"
        title="Dispatch to Layers"
        sub="Birds sent to a Layers hall become a new Layers flock, keeping their age"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Dispatch birds
          </NewButton>
        }
      />

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Dispatch to Layers" sub="They leave Brooding and start a Layers flock" onSubmit={() => void save()} submitLabel="Dispatch">
        {form ? (
          <>
            <SelectField
              label="From batch"
              value={batch}
              onChange={(v) => setForm({ ...form, batch: v })}
              options={active.map((x) => ({ label: `${x.batch} (${fmtK(alive(x.batch))} birds)`, value: x.batch }))}
            />
            <FieldRow>
              <TextField label="Birds" type="number" value={form.birds} onChange={(v) => setForm({ ...form, birds: v })} placeholder="3000" />
              <TextField label="Their weight (kg, optional)" type="number" value={form.kg} onChange={(v) => setForm({ ...form, kg: v })} />
            </FieldRow>
            <FieldRow>
              <TextField label="New Layers batch" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="FOCUS 20" />
              <SelectField
                label="Layers hall"
                value={house}
                onChange={(v) => setForm({ ...form, house: v })}
                options={S.houses.map((h) => ({ label: `${h.code} (holds ${fmtK(h.capacity)})`, value: h.code }))}
              />
            </FieldRow>
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            {ageThen !== null ? (
              <div className="text-[13px] text-[#465657]">
                They go to Layers at <span className="font-semibold">{fmtAge(ageThen)}</span> old, as a growing flock — mark it in
                lay on Layers → Batches when it starts laying.
              </div>
            ) : null}
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Kpi label="Sent this month" value={fmtK(sentMonth)} sub="birds to Layers" color="#055a5b" />
        <Kpi label="Sent in all" value={fmtK(rows.reduce((a, x) => a + x.birds, 0))} sub={`${rows.length} dispatches`} />
        <Kpi label="Still brooding" value={fmtK(active.reduce((a, x) => a + alive(x.batch), 0))} sub={`${active.length} batches`} />
      </div>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>From</Th>
            <Th right>Birds</Th>
            <Th right>Age</Th>
            <Th right>Weight</Th>
            <Th>Layers batch</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  Nothing sent to Layers yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((x) => {
              const from = batchOf(x.batch);
              const age = from ? ageOn(from, x.date) : null;
              return (
                <TRow key={x.id}>
                  <Td>
                    {fmtD(x.date)}
                    <Recorded at={x.createdAt} date={x.date} />
                  </Td>
                  <Td className="font-semibold">{x.batch}</Td>
                  <Td right>{fmtK(x.birds)}</Td>
                  <Td right>{age === null ? "—" : fmtAge(age)}</Td>
                  <Td right>
                    {x.kg ? fmtKg(x.kg, 1) : "—"}
                    {x.kg ? <div className="text-[11.5px] text-[#84908f]">{fmtKg(x.kg / x.birds, 2)} a bird</div> : null}
                  </Td>
                  <Td className="font-semibold">{x.layersBatch}</Td>
                  <Td right>
                    <DeleteButton
                      kind="broodingDispatch"
                      id={x.id}
                      what={`this dispatch to ${x.layersBatch}`}
                      body={`The birds come back to ${x.batch} and Layers' ${x.layersBatch} is removed. Refused once Layers has recorded anything for it.`}
                    />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Each dispatch creates a Layers batch in the hall chosen, with the birds&apos; breed and age, as a growing flock. Weigh
        them on the way out if you can: it counts toward the batch&apos;s FCR on Analysis.
      </Note>
    </>
  );
}
