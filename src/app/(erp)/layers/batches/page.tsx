"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, stBadge } from "@/lib/erp/derive";
import { Badge, Card, PageHeader, Recorded } from "@/components/erp/ui";
import {
  DayField,
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";

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

  // When a flock starts laying (it only counts toward the lay rate from then).
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
    const placed = splitTotal(newSplit);
    if (placed && placed !== birds) return setError(`Place all ${fmtK(birds)} birds, or leave the houses empty for now.`);
    setError("");
    if (!(await S.addBatch({
      batch: form.batch.trim().toUpperCase(),
      breed: form.breed,
      supplier: form.supplier.trim() || "—",
      received,
      inLay: form.inLay || undefined,
      birds,
      mortality: 0,
      placements: splitRows(newSplit),
      st: "active",
    })).ok) return;
    setForm({ ...form, batch: "", supplier: "", birds: "", received: "", inLay: "" });
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
            label="Started laying (optional)"
            type="date"
            value={form.inLay}
            onChange={(v) => setForm({ ...form, inLay: v })}
          />
        </FieldRow>
        <div className="-mt-2 text-[12px] text-[#84908f]">
          Leave “started laying” empty for pullets — mark the batch in lay when it starts, so the lay
          rate isn&apos;t diluted.
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
        sub="From this date the flock counts toward the lay rate"
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
                <div className="font-sub text-[16px]">{b.batch}</div>
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
              {b.st === "active" ? (
                <div className="mt-3.5 flex gap-2 border-t border-[#ebf0ef] pt-3">
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
                    onClick={() => {
                      if (window.confirm(`Close ${b.batch}? It leaves ${b.placements.length ? b.house : "its house"} and stops counting as birds in lay.`)) {
                        void S.closeBatch(b.batch);
                      }
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#f0cfc9] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#b3473a]"
                  >
                    Close batch
                  </button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
