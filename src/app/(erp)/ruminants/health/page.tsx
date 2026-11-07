"use client";

import { useState } from "react";

import { speciesOf } from "@/lib/erp/broilers";
import { fmtD } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { AnimalPicker } from "@/components/erp/AnimalPicker";
import { Badge, Card, DeleteButton, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
import { StoreDraw, useStoreItems } from "@/components/erp/StoreDraw";

const blank = { animals: [] as number[], kind: "vaccine", product: "", dosage: "", notes: "", date: "", item: "", qty: "" };
const TONE = { vaccine: ["#e3efee", "#044647"], treatment: ["#fcf2de", "#7a5410"], deworming: ["#ebf0ef", "#5d6b6b"] } as const;

/** Vaccines, treatments and deworming, for one animal or many at once. */
export default function RuminantHealth() {
  const S = useErp();
  const items = useStoreItems("ruminants");
  const rows = S.animalHealth;
  const paged = usePaged(rows);
  const on = S.animals.filter((a) => a.status === "active");
  const animalOf = (id: number) => S.animals.find((a) => a.id === id);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const save = async () => {
    if (!form) return;
    if (form.animals.length === 0) return setError("Choose the animals.");
    const item = items.find((i) => String(i.id) === form.item);
    if (!form.product.trim() && !item) return setError("Enter what was given.");
    if (item && !(Number(form.qty) > 0)) return setError("Enter how much each animal had.");
    if (item && Number(form.qty) * form.animals.length > item.onHand) {
      return setError(`That's ${Number(form.qty) * form.animals.length} ${item.unit}; only ${item.onHand} here.`);
    }
    const r = await S.addAnimalHealth({
      animals: form.animals,
      kind: form.kind as "vaccine",
      product: form.product.trim() || item!.name,
      item: item?.id,
      qtyEach: item ? Number(form.qty) : 0,
      dosage: form.dosage.trim(),
      notes: form.notes.trim(),
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Health"
        sub="Vaccines, treatments and deworming"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Record treatment
          </NewButton>
        }
      />
      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record treatment" sub="Choose every animal that got it" onSubmit={() => void save()} submitLabel="Record">
        {form ? (
          <>
            <FieldRow>
              <SelectField
                label="Type"
                value={form.kind}
                onChange={(v) => setForm({ ...form, kind: v })}
                options={[
                  { label: "Vaccine", value: "vaccine" },
                  { label: "Treatment", value: "treatment" },
                  { label: "Deworming", value: "deworming" },
                ]}
              />
              <TextField label="What was given" value={form.product} onChange={(v) => setForm({ ...form, product: v })} placeholder="PPR vaccine" />
            </FieldRow>
            <StoreDraw
              location="ruminants"
              item={form.item}
              qty={form.qty}
              qtyLabel="Each animal had"
              onChange={(item, qty) => setForm({ ...form, item, qty })}
            />
            <TextField label="Dose and route (optional)" value={form.dosage} onChange={(v) => setForm({ ...form, dosage: v })} />
            <AnimalPicker animals={on} value={form.animals} onChange={(animals) => setForm({ ...form, animals })} />
            <TextField label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
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
            <Th>Type</Th>
            <Th>Given</Th>
            <Th>Dose</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={6} className="text-[#84908f]">
                  Nothing recorded yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((h) => {
              const a = animalOf(h.animal);
              return (
                <TRow key={h.id}>
                  <Td>
                    {fmtD(h.date)}
                    <Recorded at={h.createdAt} date={h.date} />
                  </Td>
                  <Td>
                    <span className="font-semibold">{a?.tag ?? "—"}</span>
                    <div className="text-[12px] text-[#84908f]">{a ? speciesOf(a.species).one : ""}</div>
                  </Td>
                  <Td>
                    <Badge label={h.kind} bg={TONE[h.kind][0]} fg={TONE[h.kind][1]} />
                  </Td>
                  <Td>
                    {h.product}
                    {h.notes ? <div className="text-[12px] text-[#84908f]">{h.notes}</div> : null}
                    {h.item ? (
                      <div className="text-[12px] text-[#84908f]">
                        {h.qty} {S.invItems.find((i) => i.id === h.item)?.unit ?? ""} from the store
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-[#465657]">{h.dosage || "—"}</Td>
                  <Td right>
                    <DeleteButton kind="animalHealth" id={h.id} what={`the ${fmtD(h.date)} ${h.product} record for ${a?.tag ?? "this animal"}`} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        One line per animal, so each animal&apos;s history shows on Animals → View. What was drawn from the Ruminants store
        comes off Inventory, each animal&apos;s share on its own line; deleting a line puts that share back.
      </Note>
    </>
  );
}
