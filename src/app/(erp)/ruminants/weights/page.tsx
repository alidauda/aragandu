"use client";

import { useState } from "react";

import { speciesOf } from "@/lib/erp/broilers";
import { animalAge } from "@/lib/erp/ruminants";
import { fmtD } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, DeleteButton, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
import { EditAnimalWeight } from "@/components/erp/EditEntry";

/** Each animal's weights, and its gain since the time before. */
export default function RuminantWeights() {
  const S = useErp();
  const rows = S.animalWeights;
  const paged = usePaged(rows);
  const on = S.animals.filter((a) => a.status === "active");
  const animalOf = (id: number) => S.animals.find((a) => a.id === id);
  const before = (w: (typeof rows)[number]) =>
    rows.filter((x) => x.animal === w.animal && (x.date < w.date || (x.date === w.date && x.id < w.id))).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];

  const [form, setForm] = useState<{ animal: string; kg: string; date: string } | null>(null);
  const [error, setError] = useState("");
  const animal = Number(form?.animal || on[0]?.id || 0);
  const save = async () => {
    if (!form) return;
    const kg = Number(form.kg);
    if (!animal) return setError("Add an animal first.");
    if (!(kg > 0)) return setError("Enter its weight in kg.");
    const r = await S.addAnimalWeight({ animal, kg, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    // Ready for the next animal.
    setForm({ animal: "", kg: "", date: form.date });
  };

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Weights"
        sub="Weigh an animal; its gain since last time is worked out for you"
        action={
          <NewButton
            onClick={() => {
              setForm({ animal: "", kg: "", date: "" });
              setError("");
            }}
          >
            Record weight
          </NewButton>
        }
      />
      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record weight" sub="One animal at a time; the drawer stays open for the next" onSubmit={() => void save()} submitLabel="Record">
        {form ? (
          <>
            <SelectField
              label="Animal"
              value={String(animal)}
              onChange={(v) => setForm({ ...form, animal: v })}
              options={on.map((a) => ({ label: `${a.tag} · ${speciesOf(a.species).one}${a.pen ? ` · ${a.pen}` : ""}`, value: String(a.id) }))}
            />
            <TextField label="Weight (kg)" type="number" value={form.kg} onChange={(v) => setForm({ ...form, kg: v })} placeholder="28.5" />
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>
      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Animal</Th>
            <Th right>Age</Th>
            <Th right>Weight</Th>
            <Th right>Gain a day</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={6} className="text-[#84908f]">
                  Nothing weighed yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((w) => {
              const a = animalOf(w.animal);
              const prev = before(w);
              const days = prev ? Math.round((Date.parse(w.date) - Date.parse(prev.date)) / 86_400_000) : 0;
              return (
                <TRow key={w.id}>
                  <Td>
                    {fmtD(w.date)}
                    <Recorded at={w.createdAt} date={w.date} />
                  </Td>
                  <Td>
                    <span className="font-semibold">{a?.tag ?? "—"}</span>
                    <div className="text-[12px] text-[#84908f]">{a ? speciesOf(a.species).one : ""}</div>
                  </Td>
                  <Td right>{a ? animalAge(a.born, w.date) : "—"}</Td>
                  <Td right className="font-semibold">
                    {w.kg} kg
                  </Td>
                  <Td right>{prev && days > 0 ? `${Math.round(((w.kg - prev.kg) * 1000) / days)} g` : "—"}</Td>
                  <Td right className="whitespace-nowrap">
                    <EditAnimalWeight w={w} tag={a?.tag ?? "this animal"} />
                    <DeleteButton kind="animalWeight" id={w.id} what={`the ${fmtD(w.date)} weight of ${a?.tag ?? "this animal"}`} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>Gain a day is since that animal&apos;s weight before this one.</Note>
    </>
  );
}
