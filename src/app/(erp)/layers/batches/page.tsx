"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, stBadge } from "@/lib/erp/derive";
import { Badge, Card, EditButton, PageHeader, Recorded } from "@/components/erp/ui";
import {
  DayField,
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import { confirmDialog } from "@/components/Dialogs";

const label = "text-[12.5px] font-medium text-[#738080]";

/** Birds per house, as typed: house code → count text. */
type Split = Record<string, string>;
const splitRows = (split: Split) =>
  Object.entries(split)
    .map(([house, v]) => ({ house, birds: Number(v) }))
    .filter((p) => p.birds > 0);
const splitTotal = (split: Split) => splitRows(split).reduce((a, p) => a + p.birds, 0);

/** One number per house, with the room each has left. */
function SplitEditor({
  split,
  onChange,
  total,
  room,
}: {
  split: Split;
  onChange: (s: Split) => void;
  total: number;
  room: (house: string) => number;
}) {
  const S = useErp();
  const placed = splitTotal(split);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-[#465657]">Birds in each house</span>
        <span className={`text-[12.5px] font-semibold ${placed === total ? "text-[#016559]" : "text-[#9a6a12]"}`}>
          {fmtK(placed)} of {fmtK(total)} placed
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {S.houses.map((h) => (
          <div key={h.code} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[14px] font-semibold">{h.code}</span>
            <input
              type="number"
              min={0}
              value={split[h.code] ?? ""}
              onChange={(e) => onChange({ ...split, [h.code]: e.target.value })}
              placeholder="0"
              className="w-28 rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2 text-[14px]"
            />
            <span className="text-[12px] text-[#84908f]">room for {fmtK(Math.max(0, room(h.code)))}</span>
          </div>
        ))}
      </div>
      {total > 0 && placed < total ? (
        <button
          type="button"
          onClick={() => {
            // Puts the birds not yet placed into the first house with room.
            const left = total - placed;
            const h = S.houses.find((x) => room(x.code) - (Number(split[x.code]) || 0) >= left);
            if (h) onChange({ ...split, [h.code]: String((Number(split[h.code]) || 0) + left) });
          }}
          className="mt-1.5 text-[12px] font-semibold text-[#055a5b]"
        >
          Place the other {fmtK(total - placed)}
        </button>
      ) : null}
    </div>
  );
}

/** Admin: removes a batch entered by mistake (or sample data). */
function DeleteBatch({ batch, onError }: { batch: string; onError: (text: string) => void }) {
  const S = useErp();
  return (
    <button
      type="button"
      disabled={S.saving}
      onClick={async () => {
        const ok = await confirmDialog({
          title: `Delete ${batch}?`,
          body: "It goes completely, with its birds-out records. For a real flock that left, use Close batch instead.",
          confirmLabel: "Delete batch",
          danger: true,
        });
        if (!ok) return;
        void S.deleteBatch(batch).then((r) => {
          if (!r.ok) onError(r.error);
        });
      }}
      className="rounded-md px-1.5 text-[12px] font-semibold text-[#c7402f] opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30"
    >
      Delete
    </button>
  );
}

export default function LayersBatches() {
  const S = useErp();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    batch: "",
    breed: "ISA Brown",
    supplier: "",
    birds: "",
    received: "",
    ageWeeks: "",
    inLay: "",
  });
  const [newSplit, setNewSplit] = useState<Split>({});

  // Room in a house: capacity less the birds other batches have there.
  const room = (house: string, except?: string) =>
    (S.houses.find((h) => h.code === house)?.capacity ?? 0) -
    S.batches
      .filter((b) => b.st === "active" && b.batch !== except)
      .reduce((a, b) => a + (b.placements.find((p) => p.house === house)?.birds ?? 0), 0);

  // Spreading an active batch over houses.
  const [placeFor, setPlaceFor] = useState<string | null>(null);
  const [split, setSplit] = useState<Split>({});
  const [placeError, setPlaceError] = useState("");
  const placing = S.batches.find((b) => b.batch === placeFor);
  const openPlace = (b: (typeof S.batches)[number]) => {
    setSplit(Object.fromEntries(b.placements.map((p) => [p.house, String(p.birds)])));
    setPlaceError("");
    setPlaceFor(b.batch);
  };
  // Admin: correct a batch's details and birds placed.
  const [edit, setEdit] = useState<{
    batch: string;
    code: string;
    breed: string;
    supplier: string;
    received: string;
    ageWeeks: string;
    inLay: string;
    birds: string;
  } | null>(null);
  const [editSplit, setEditSplit] = useState<Split>({});
  const [editError, setEditError] = useState("");
  const editing = S.batches.find((b) => b.batch === edit?.batch);
  const editBirds = Number(edit?.birds);
  // A batch in several houses whose bird count changes needs the new split.
  const needsSplit = !!editing && editing.st === "active" && editing.placements.length > 1 && editBirds !== editing.birds;
  const openEdit = (b: (typeof S.batches)[number]) => {
    setEdit({
      batch: b.batch,
      code: b.batch,
      breed: b.breed,
      supplier: b.supplier,
      received: b.received,
      ageWeeks: b.ageOnArrival ? String(b.ageOnArrival / 7) : "",
      inLay: b.inLay ?? "",
      birds: String(b.birds),
    });
    setEditSplit(Object.fromEntries(b.placements.map((p) => [p.house, String(p.birds)])));
    setEditError("");
  };
  const saveEdit = async () => {
    if (!edit || !editing) return;
    if (!edit.code.trim()) return setEditError("Enter the batch number.");
    if (!Number.isInteger(editBirds) || editBirds <= 0) return setEditError("Enter the number of birds placed.");
    if (editBirds < editing.mortality) {
      return setEditError(`${fmtK(editing.mortality)} birds have already left — it can't be fewer.`);
    }
    if (edit.received > S.today) return setEditError("The arrival date can't be in the future.");
    if (edit.inLay && edit.inLay < edit.received) return setEditError("Laying can't start before the flock arrived.");
    if (!(Number(edit.ageWeeks) >= 0)) return setEditError("Enter the age on arrival in weeks.");
    if (needsSplit && splitTotal(editSplit) !== editBirds - editing.mortality) {
      return setEditError(`Spread all ${fmtK(editBirds - editing.mortality)} birds over the houses.`);
    }
    setEditError("");
    const r = await S.updateBatch({
      batch: edit.batch,
      code: edit.code.trim().toUpperCase(),
      breed: edit.breed.trim() || "—",
      supplier: edit.supplier.trim() || "—",
      received: edit.received,
      ageOnArrival: Math.round(Number(edit.ageWeeks) * 7),
      inLay: edit.inLay || null,
      birds: editBirds,
      placements: needsSplit ? splitRows(editSplit) : undefined,
    });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };

  const savePlace = async () => {
    if (!placing) return;
    const alive = placing.birds - placing.mortality;
    if (splitTotal(split) !== alive) return setPlaceError(`Place all ${fmtK(alive)} birds.`);
    setPlaceError("");
    const r = await S.placeBatch({ batch: placing.batch, placements: splitRows(split) });
    if (!r.ok) return setPlaceError(r.error);
    setPlaceFor(null);
  };

  const [deathsFor, setDeathsFor] = useState<string | null>(null);
  const [deaths, setDeaths] = useState("");
  const [outReason, setOutReason] = useState<"died" | "culled">("died");
  const [deathsError, setDeathsError] = useState("");
  const [batchError, setBatchError] = useState<{ batch: string; text: string } | null>(null);
  const [deathsDay, setDeathsDay] = useState("");
  const [deathsHouse, setDeathsHouse] = useState("");
  const deathsBatch = S.batches.find((b) => b.batch === deathsFor);

  const saveDeaths = async () => {
    const n = Number(deaths);
    if (!Number.isInteger(n) || n <= 0) return setDeathsError("Enter a whole number of birds.");
    setDeathsError("");
    const r = await S.recordMortality({
      batch: deathsFor!,
      house: deathsHouse || undefined,
      birds: n,
      reason: outReason,
      date: deathsDay || undefined,
    });
    if (!r.ok) return setDeathsError(r.error);
    setDeathsFor(null);
  };

  // When a flock starts laying (it only counts toward % production from then).
  const [layFor, setLayFor] = useState<string | null>(null);
  const [layDate, setLayDate] = useState("");
  const [layError, setLayError] = useState("");
  const saveLay = async () => {
    if (!layDate) return setLayError("Pick the date laying started.");
    setLayError("");
    const r = await S.setInLay(layFor!, layDate);
    if (!r.ok) return setLayError(r.error);
    setLayFor(null);
  };

  const save = async () => {
    const birds = Number(form.birds);
    if (!form.batch.trim()) return setError("Enter the batch number.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the number of birds.");
    const received = form.received || S.today;
    if (received > S.today) return setError("The arrival date can't be in the future.");
    if (form.inLay && form.inLay < received) return setError("Laying can't start before the flock arrived.");
    if (!(Number(form.ageWeeks) >= 0)) return setError("Enter the age on arrival in weeks.");
    const placed = splitTotal(newSplit);
    if (placed && placed !== birds) return setError(`Place all ${fmtK(birds)} birds, or leave the houses empty for now.`);
    setError("");
    if (!(await S.addBatch({
      batch: form.batch.trim().toUpperCase(),
      breed: form.breed,
      supplier: form.supplier.trim() || "—",
      received,
      ageOnArrival: Math.round(Number(form.ageWeeks) * 7),
      inLay: form.inLay || undefined,
      birds,
      mortality: 0,
      placements: splitRows(newSplit),
      st: "active",
    })).ok) return;
    setForm({ ...form, batch: "", supplier: "", birds: "", received: "", ageWeeks: "", inLay: "" });
    setNewSplit({});
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Batches"
        sub="Flocks placed — birds now, birds out, house, when they started laying"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            New batch
          </NewButton>
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New batch"
        sub="A flock placed — split it over several houses if you need to"
        onSubmit={save}
        submitLabel="Place batch"
      >
        <FieldRow>
          <TextField
            label="Batch number"
            value={form.batch}
            onChange={(v) => setForm({ ...form, batch: v })}
            placeholder="B-2608"
          />
          <SelectField
            label="Breed"
            value={form.breed}
            onChange={(v) => setForm({ ...form, breed: v })}
            options={["ISA Brown", "Lohmann Brown", "Bovans Black"].map((b) => ({
              label: b,
              value: b,
            }))}
          />
        </FieldRow>
        <TextField
          label="Supplier"
          value={form.supplier}
          onChange={(v) => setForm({ ...form, supplier: v })}
          placeholder="Zartech"
        />
        <TextField
          label="Birds"
          type="number"
          value={form.birds}
          onChange={(v) => setForm({ ...form, birds: v })}
          placeholder="2400"
        />
        <SplitEditor
          split={newSplit}
          onChange={setNewSplit}
          total={Number(form.birds) || 0}
          room={(h) => room(h)}
        />
        <FieldRow>
          <TextField
            label="Arrived"
            type="date"
            value={form.received || S.today}
            onChange={(v) => setForm({ ...form, received: v })}
          />
          <TextField
            label="Age on arrival (weeks)"
            type="number"
            value={form.ageWeeks}
            onChange={(v) => setForm({ ...form, ageWeeks: v })}
            placeholder="0"
          />
        </FieldRow>
        <TextField
          label="Started laying (optional)"
          type="date"
          value={form.inLay}
          onChange={(v) => setForm({ ...form, inLay: v })}
        />
        <div className="-mt-2 text-[12px] text-[#84908f]">
          Leave “started laying” empty for pullets — mark the batch in lay when it starts, so %
          production isn&apos;t diluted.
        </div>
        <FormError message={error} />
      </Drawer>

      <Drawer
        open={deathsFor !== null}
        onClose={() => setDeathsFor(null)}
        title={`Birds out — ${deathsFor ?? ""}`}
        sub="Deaths and culls on one day. Sales of spent hens go through Record sale."
        onSubmit={() => void saveDeaths()}
        submitLabel="Record"
      >
        {deathsBatch && deathsBatch.placements.length > 1 ? (
          <SelectField
            label="From house"
            value={deathsHouse}
            onChange={setDeathsHouse}
            options={deathsBatch.placements.map((p) => ({ label: `${p.house} (${fmtK(p.birds)} birds)`, value: p.house }))}
          />
        ) : null}
        <FieldRow>
          <TextField label="Birds" type="number" value={deaths} onChange={setDeaths} placeholder="3" />
          <SelectField
            label="Why"
            value={outReason}
            onChange={(v) => setOutReason(v as "died" | "culled")}
            options={[
              { label: "Died", value: "died" },
              { label: "Culled", value: "culled" },
            ]}
          />
        </FieldRow>
        <DayField value={deathsDay} onChange={setDeathsDay} />
        <FormError message={deathsError} />
      </Drawer>

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={`Edit ${edit?.batch ?? "batch"}`}
        sub="Corrections — its records follow a new number"
        onSubmit={() => void saveEdit()}
        submitLabel="Save"
      >
        {edit && editing ? (
          <>
            <FieldRow>
              <TextField label="Batch number" value={edit.code} onChange={(v) => setEdit({ ...edit, code: v })} />
              <SelectField
                label="Breed"
                value={edit.breed}
                onChange={(v) => setEdit({ ...edit, breed: v })}
                options={[...new Set(["ISA Brown", "Lohmann Brown", "Bovans Black", editing.breed])].map((x) => ({
                  label: x,
                  value: x,
                }))}
              />
            </FieldRow>
            <TextField label="Supplier" value={edit.supplier} onChange={(v) => setEdit({ ...edit, supplier: v })} />
            <FieldRow>
              <TextField
                label="Arrived"
                type="date"
                value={edit.received}
                onChange={(v) => setEdit({ ...edit, received: v })}
              />
              <TextField
                label="Age on arrival (weeks)"
                type="number"
                value={edit.ageWeeks}
                onChange={(v) => setEdit({ ...edit, ageWeeks: v })}
                placeholder="0"
              />
            </FieldRow>
            <TextField
              label="Started laying (empty = not yet)"
              type="date"
              value={edit.inLay}
              onChange={(v) => setEdit({ ...edit, inLay: v })}
            />
            <TextField
              label="Birds placed"
              type="number"
              value={edit.birds}
              onChange={(v) => setEdit({ ...edit, birds: v })}
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">
              {fmtK(editing.mortality)} have left so far, so it has{" "}
              {Number.isInteger(editBirds) && editBirds >= editing.mortality
                ? `${fmtK(editBirds - editing.mortality)} birds now`
                : "—"}
              .
              {editing.st === "active" && editing.placements.length === 1
                ? ` ${editing.placements[0].house} changes with it.`
                : ""}
            </div>
            {needsSplit && editBirds >= editing.mortality ? (
              <SplitEditor
                split={editSplit}
                onChange={setEditSplit}
                total={editBirds - editing.mortality}
                room={(h) => room(h, editing.batch)}
              />
            ) : null}
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={placeFor !== null}
        onClose={() => setPlaceFor(null)}
        title={`Houses — ${placeFor ?? ""}`}
        sub="Move the batch, or split its birds over several houses"
        onSubmit={() => void savePlace()}
        submitLabel="Save"
      >
        {placing ? (
          <SplitEditor
            split={split}
            onChange={setSplit}
            total={placing.birds - placing.mortality}
            room={(h) => room(h, placing.batch)}
          />
        ) : null}
        <FormError message={placeError} />
      </Drawer>

      <Drawer
        open={layFor !== null}
        onClose={() => setLayFor(null)}
        title={`In lay — ${layFor ?? ""}`}
        sub="From this date the flock counts toward % production"
        onSubmit={() => void saveLay()}
        submitLabel="Save"
      >
        <TextField label="Started laying" type="date" value={layDate} onChange={setLayDate} />
        <FormError message={layError} />
      </Drawer>

      <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {S.batches.map((b) => {
          const s = stBadge(b.st);
          return (
            <Card key={b.batch} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="font-sub text-[16px]">
                  {b.batch}
                  <EditButton onClick={() => openEdit(b)} />
                </div>
                <Badge label={b.st} bg={s.bg} fg={s.fg} />
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#84908f]">
                {b.breed} · {b.supplier}
              </div>
              <Recorded at={b.createdAt} />
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <div>
                  <div className={label}>Birds now</div>
                  <div className="font-data text-[17px] font-bold">
                    {fmtK(b.birds - b.mortality)}
                  </div>
                </div>
                <div>
                  <div className={label}>Birds out</div>
                  <div className="font-data text-[17px] font-bold text-[#c7402f]">{fmtK(b.mortality)}</div>
                  {b.mortality ? (
                    <div className="text-[11.5px] text-[#84908f]">
                      {[
                        b.out.died && `${b.out.died} died`,
                        b.out.culled && `${b.out.culled} culled`,
                        b.out.sold && `${b.out.sold} sold`,
                      ]
                        .filter(Boolean)
                        .join(", ") || "recorded before reasons"}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className={label}>{b.placements.length > 1 ? "Houses" : "House"}</div>
                  {b.placements.length ? (
                    b.placements.map((p) => (
                      <div key={p.house} className="text-[14px]">
                        <span className="font-bold">{p.house}</span>
                        {b.placements.length > 1 ? (
                          <span className="ml-1.5 font-data text-[#5d6b6b]">{fmtK(p.birds)}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-[17px] font-bold">—</div>
                  )}
                  {b.st === "active" ? (
                    <button
                      onClick={() => openPlace(b)}
                      disabled={S.saving}
                      className="mt-0.5 text-[12px] font-semibold text-[#055a5b] underline"
                    >
                      {b.placements.length ? "Move or split" : "Place in houses"}
                    </button>
                  ) : null}
                </div>
                <div>
                  <div className={label}>Arrived</div>
                  <div className="font-data text-sm font-semibold">
                    {fmtD(b.received)} {b.received.slice(0, 4)}
                  </div>
                </div>
                <div>
                  <div className={label}>In lay</div>
                  <div className="font-data text-sm font-semibold">
                    {b.inLay ? (
                      `since ${fmtD(b.inLay)}`
                    ) : b.st === "active" ? (
                      <button
                        onClick={() => {
                          setLayFor(b.batch);
                          setLayDate(S.today);
                          setLayError("");
                        }}
                        className="font-semibold text-[#055a5b] underline"
                      >
                        Mark in lay
                      </button>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
              {batchError?.batch === b.batch ? <p className="mt-2 text-[12.5px] text-[#c7402f]">{batchError.text}</p> : null}
              {b.st === "closed" && S.isAdmin ? (
                <div className="mt-3.5 border-t border-[#ebf0ef] pt-3">
                  <DeleteBatch batch={b.batch} onError={(text) => setBatchError({ batch: b.batch, text })} />
                </div>
              ) : null}
              {b.st === "active" ? (
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#ebf0ef] pt-3">
                  <button
                    onClick={() => {
                      setDeaths("");
                      setDeathsDay("");
                      setDeathsError("");
                      setDeathsHouse(b.placements[0]?.house ?? "");
                      setDeathsFor(b.batch);
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#d6dfde] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#055a5b]"
                  >
                    Birds out
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: `Close ${b.batch}?`,
                        body: `It leaves ${b.placements.length ? b.house : "its house"} and stops counting as birds in lay.`,
                        confirmLabel: "Close batch",
                        danger: true,
                      });
                      if (ok) void S.closeBatch(b.batch);
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#f0cfc9] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#b3473a]"
                  >
                    Close batch
                  </button>
                  {S.isAdmin ? <DeleteBatch batch={b.batch} onError={(text) => setBatchError({ batch: b.batch, text })} /> : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
