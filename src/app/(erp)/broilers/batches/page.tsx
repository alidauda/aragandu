"use client";

import { useState } from "react";

import { BROILER_BREEDS, broilersAlive, LAYER_BREEDS } from "@/lib/erp/broilers";
import { fmtAge, ageOn, fmtD, fmtK } from "@/lib/erp/derive";
import { useBirdUnit } from "@/components/erp/useUnit";
import type { BroilerBatch } from "@/lib/erp/types";
import { confirmDialog } from "@/components/Dialogs";
import { Badge, Card, CardTitle, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { batch: "", code: "", breed: BROILER_BREEDS[0], supplier: "", birds: "", house: "", received: "", ageOnArrival: "", chickWeight: "40" };
const small = "rounded-md px-1.5 text-[12.5px] font-semibold";

/** Broiler batches and the houses they're in. */
export default function BroilerBatches() {
  const S = useBirdUnit();
  const admin = S.canDo(S.unit, "admin");
  const alive = (b: BroilerBatch) => broilersAlive(b, S);
  const batches = [...S.broilerBatches].sort((a, b) => (a.st === b.st ? b.received.localeCompare(a.received) : a.st === "active" ? -1 : 1));
  const paged = usePaged(batches);
  const housePage = usePaged(S.broilerHouses);
  const inHouse = (h: string) => S.broilerBatches.filter((b) => b.st === "active" && b.house === h).reduce((a, b) => a + alive(b), 0);

  // Add or edit a batch.
  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const editing = form?.batch ? S.broilerBatches.find((b) => b.batch === form.batch) : undefined;
  const breeds = S.unit === "brooding" ? LAYER_BREEDS : BROILER_BREEDS;
  const openAdd = () => {
    setForm({ ...blank, breed: breeds[0], house: S.broilerHouses[0]?.code ?? "" });
    setError("");
  };
  const openEdit = (b: BroilerBatch) => {
    setForm({
      batch: b.batch,
      code: b.batch,
      breed: b.breed,
      supplier: b.supplier,
      birds: String(b.birds),
      house: b.house ?? "",
      received: b.received,
      ageOnArrival: b.ageOnArrival ? String(b.ageOnArrival) : "",
      chickWeight: String(b.chickWeight),
    });
    setError("");
  };
  const save = async () => {
    if (!form) return;
    const birds = Number(form.birds);
    const ageOnArrival = Number(form.ageOnArrival || 0);
    const chickWeight = Number(form.chickWeight || 40);
    if (!form.code.trim()) return setError("Enter the batch number.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the number of birds.");
    if (!Number.isInteger(ageOnArrival) || ageOnArrival < 0) return setError("Enter the age on arrival in whole days.");
    if (!Number.isInteger(chickWeight) || chickWeight <= 0) return setError("Enter the chick weight in grams.");
    const received = form.received || S.today;
    if (received > S.today) return setError("The arrival date can't be in the future.");
    const fields = {
      breed: form.breed.trim() || "—",
      supplier: form.supplier.trim() || "—",
      received,
      ageOnArrival,
      chickWeight,
      birds,
      house: form.house || undefined,
    };
    const code = form.code.trim().toUpperCase();
    const r = editing
      ? await S.updateBroilerBatch({ batch: editing.batch, code, ...fields })
      : await S.addBroilerBatch({ batch: code, unit: S.unit, ...fields });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  // Houses.
  const [house, setHouse] = useState<{ was: string; code: string; capacity: string } | null>(null);
  const [houseError, setHouseError] = useState("");
  const saveHouse = async () => {
    if (!house) return;
    const capacity = Number(house.capacity);
    if (!house.code.trim()) return setHouseError("Enter the house name.");
    if (!Number.isInteger(capacity) || capacity <= 0) return setHouseError("Enter how many birds it holds.");
    const code = house.code.trim().toUpperCase();
    const r = house.was
      ? await S.updateBroilerHouse({ house: house.was, code, capacity })
      : await S.addBroilerHouse({ code, capacity, unit: S.unit });
    if (!r.ok) return setHouseError(r.error);
    setHouse(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={S.u.label}
        title="Batches"
        sub="Each batch from arrival until its last birds are sold"
        action={<NewButton onClick={openAdd}>Add batch</NewButton>}
      />

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={editing ? `Edit ${editing.batch}` : "Add batch"}
        sub={editing ? "Corrections — its records follow a new number" : "Chicks placed in a house"}
        onSubmit={() => void save()}
        submitLabel="Save"
      >
        {form ? (
          <>
            <FieldRow>
              <TextField label="Batch number" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="BR-2611" />
              <SelectField
                label="Breed"
                value={form.breed}
                onChange={(v) => setForm({ ...form, breed: v })}
                options={[...new Set([...breeds, form.breed])].map((x) => ({ label: x, value: x }))}
              />
            </FieldRow>
            <FieldRow>
              <TextField label="Birds placed" type="number" value={form.birds} onChange={(v) => setForm({ ...form, birds: v })} placeholder="5000" />
              <SelectField
                label="House"
                value={form.house}
                onChange={(v) => setForm({ ...form, house: v })}
                options={[
                  ...S.broilerHouses.map((h) => ({ label: `${h.code} (${fmtK(h.capacity - inHouse(h.code))} free)`, value: h.code })),
                  { label: "Not in a house yet", value: "" },
                ]}
              />
            </FieldRow>
            <TextField label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} placeholder="Zartech" />
            <FieldRow>
              <TextField label="Arrived" type="date" value={form.received || S.today} onChange={(v) => setForm({ ...form, received: v })} />
              <TextField
                label="Age on arrival (days)"
                type="number"
                value={form.ageOnArrival}
                onChange={(v) => setForm({ ...form, ageOnArrival: v })}
                placeholder="0"
              />
            </FieldRow>
            <TextField
              label="Chick weight on arrival (grams)"
              type="number"
              value={form.chickWeight}
              onChange={(v) => setForm({ ...form, chickWeight: v })}
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">Used to work out the weight the batch has gained, for FCR. Day-old chicks weigh about 40 g.</div>
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer
        open={house !== null}
        onClose={() => setHouse(null)}
        title={house?.was ? `Edit ${house.was}` : "Add house"}
        sub={`A ${S.u.label} house, apart from the layer halls`}
        onSubmit={() => void saveHouse()}
        submitLabel="Save"
      >
        {house ? (
          <FieldRow>
            <TextField label="Name" value={house.code} onChange={(v) => setHouse({ ...house, code: v })} placeholder="BH-01" />
            <TextField label="Holds (birds)" type="number" value={house.capacity} onChange={(v) => setHouse({ ...house, capacity: v })} placeholder="6000" />
          </FieldRow>
        ) : null}
        <FormError message={houseError} />
      </Drawer>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Batch</Th>
            <Th>House</Th>
            <Th>Arrived</Th>
            <Th right>Age</Th>
            <Th right>Placed</Th>
            <Th right>Alive</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {batches.length === 0 ? (
              <TRow>
                <Td colSpan={8} className="text-[#84908f]">
                  No batches yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((b) => {
              const n = alive(b);
              const age = ageOn(b, b.st === "closed" && b.closedAt ? b.closedAt : S.today);
              return (
                <TRow key={b.batch}>
                  <Td>
                    <span className="font-semibold">{b.batch}</span>
                    <div className="text-[12px] text-[#84908f]">{b.breed}</div>
                  </Td>
                  <Td>{b.house ?? "—"}</Td>
                  <Td>{fmtD(b.received)}</Td>
                  <Td right>{age === null ? "—" : fmtAge(age)}</Td>
                  <Td right>{fmtK(b.birds)}</Td>
                  <Td right>{fmtK(n)}</Td>
                  <Td>
                    {b.st === "active" ? (
                      <Badge label="growing" bg="#e3efee" fg="#044647" />
                    ) : (
                      <Badge label={`closed ${b.closedAt ? fmtD(b.closedAt) : ""}`} bg="#ebf0ef" fg="#5d6b6b" />
                    )}
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {b.st === "active" && n === 0 ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirmDialog({ title: `Close ${b.batch}?`, body: "Every bird has left. It stops showing as growing.", confirmLabel: "Close batch" }))
                            void S.closeBroilerBatch({ batch: b.batch });
                        }}
                        className={`${small} text-[#055a5b]`}
                      >
                        Close
                      </button>
                    ) : null}
                    {admin ? (
                      <button type="button" onClick={() => openEdit(b)} className={`${small} text-[#055a5b]`}>
                        Edit
                      </button>
                    ) : null}
                    {admin ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            await confirmDialog({
                              title: `Delete ${b.batch}?`,
                              body: "Its daily records, weighings and health records go with it.",
                              confirmLabel: "Delete",
                              danger: true,
                            })
                          )
                            void S.deleteBroilerBatch({ batch: b.batch });
                        }}
                        className={`${small} text-[#c7402f] opacity-70 hover:opacity-100`}
                      >
                        Delete
                      </button>
                    ) : null}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <CardTitle>Houses</CardTitle>
          <button
            type="button"
            onClick={() => {
              setHouse({ was: "", code: "", capacity: "" });
              setHouseError("");
            }}
            className="rounded-[10px] border border-[#d6dfde] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#055a5b]"
          >
            Add house
          </button>
        </div>
        <div className="mt-2">
          <Table pager={housePage.pager}>
            <THead>
              <Th>House</Th>
              <Th right>Holds</Th>
              <Th right>Birds now</Th>
              <Th right />
            </THead>
            <tbody>
              {S.broilerHouses.length === 0 ? (
                <TRow>
                  <Td colSpan={4} className="text-[#84908f]">
                    No broiler houses yet — add one before placing a batch.
                  </Td>
                </TRow>
              ) : null}
              {housePage.rows.map((h) => (
                <TRow key={h.code}>
                  <Td className="font-semibold">{h.code}</Td>
                  <Td right>{fmtK(h.capacity)}</Td>
                  <Td right>{fmtK(inHouse(h.code))}</Td>
                  <Td right className="whitespace-nowrap">
                    {admin ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setHouse({ was: h.code, code: h.code, capacity: String(h.capacity) });
                            setHouseError("");
                          }}
                          className={`${small} text-[#055a5b]`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirmDialog({ title: `Delete ${h.code}?`, confirmLabel: "Delete", danger: true }))
                              void S.deleteBroilerHouse({ code: h.code });
                          }}
                          className={`${small} text-[#c7402f] opacity-70 hover:opacity-100`}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        A batch closes once every bird has been sold, died or been culled. Admins can correct a batch or a house;
        deleting a batch is refused once birds were sold from it.
      </Note>
    </>
  );
}
