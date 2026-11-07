"use client";

import { useState } from "react";

import { ageOn, fmtAge, fmtD } from "@/lib/erp/derive";
import { useBirdUnit } from "@/components/erp/useUnit";
import { Badge, Card, DeleteButton, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
import { drawFrom, StoreDraw, useStoreItems } from "@/components/erp/StoreDraw";

const blank = { batch: "", kind: "vaccine", product: "", dosage: "", notes: "", date: "", item: "", qty: "" };

/** Vaccines and medication given to each batch. */
export default function BroilerHealth() {
  const S = useBirdUnit();
  const items = useStoreItems(S.unit);
  const rows = S.broilerHealth;
  const paged = usePaged(rows);
  const active = S.broilerBatches.filter((b) => b.st === "active");

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const batch = form?.batch || active[0]?.batch || "";
  const save = async () => {
    if (!form) return;
    if (!batch) return setError("Add a batch first.");
    const drawn = drawFrom(items, form.item);
    const item = drawn?.item;
    if (!form.product.trim() && !item) return setError("Enter what was given.");
    if (item && !(Number(form.qty) > 0)) return setError("Enter how much was used from the store.");
    if (item && Number(form.qty) > item.onHand) return setError(`Only ${item.onHand} ${item.unit} of ${item.name} at ${item.where}.`);
    const r = await S.addBroilerHealth({
      batch,
      kind: form.kind as "vaccine",
      product: form.product.trim() || item!.name,
      item: item?.id,
      from: drawn?.from,
      qty: item ? Number(form.qty) : 0,
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
        eyebrow={S.u.label}
        title="Health"
        sub="Vaccines and medication given to each batch"
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

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record treatment" sub="A vaccine or medication given to a batch" onSubmit={() => void save()} submitLabel="Record">
        {form ? (
          <>
            <FieldRow>
              <SelectField label="Batch" value={batch} onChange={(v) => setForm({ ...form, batch: v })} options={active.map((b) => ({ label: b.batch, value: b.batch }))} />
              <SelectField
                label="Type"
                value={form.kind}
                onChange={(v) => setForm({ ...form, kind: v })}
                options={[
                  { label: "Vaccine", value: "vaccine" },
                  { label: "Medication", value: "medication" },
                ]}
              />
            </FieldRow>
            <TextField label="What was given" value={form.product} onChange={(v) => setForm({ ...form, product: v })} placeholder="Gumboro (IBD) — or choose from the store" />
            <StoreDraw location={S.unit} item={form.item} qty={form.qty} onChange={(item, qty) => setForm({ ...form, item, qty })} />
            <TextField label="Dose and route (optional)" value={form.dosage} onChange={(v) => setForm({ ...form, dosage: v })} placeholder="Drinking water" />
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
            <Th>Batch</Th>
            <Th right>Age</Th>
            <Th>Type</Th>
            <Th>Given</Th>
            <Th>Dose</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  Nothing recorded yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((h) => {
              const b = S.broilerBatches.find((x) => x.batch === h.batch);
              const age = b ? ageOn(b, h.date) : null;
              return (
                <TRow key={h.id}>
                  <Td>
                    {fmtD(h.date)}
                    <Recorded at={h.createdAt} date={h.date} />
                  </Td>
                  <Td className="font-semibold">{h.batch}</Td>
                  <Td right>{age === null ? "—" : fmtAge(age)}</Td>
                  <Td>
                    <Badge label={h.kind} bg={h.kind === "vaccine" ? "#e3efee" : "#fcf2de"} fg={h.kind === "vaccine" ? "#044647" : "#7a5410"} />
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
                    <DeleteButton kind="broilerHealth" id={h.id} what={`the ${fmtD(h.date)} ${h.product} record`} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Choose what was drawn — from the {S.u.label} store or the main store — and it comes off Inventory; deleting the
        record puts it back.
      </Note>
    </>
  );
}
