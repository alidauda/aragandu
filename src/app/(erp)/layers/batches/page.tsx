"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, stBadge } from "@/lib/erp/derive";
import { Badge, Card, PageHeader } from "@/components/erp/ui";
import {
  DayField,
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";

const label = "text-[12.5px] font-medium text-[#7a857d]";

export default function LayersBatches() {
  const S = useErp();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    batch: "",
    breed: "ISA Brown",
    supplier: "",
    birds: "",
    house: "",
    received: "",
    inLay: "",
  });
  // "—" = not placed in a house yet.
  const house = form.house === "—" || S.houses.some((h) => h.code === form.house)
    ? form.house
    : (S.houses[0]?.code ?? "—");

  const [deathsFor, setDeathsFor] = useState<string | null>(null);
  const [deaths, setDeaths] = useState("");
  const [outReason, setOutReason] = useState<"died" | "culled">("died");
  const [deathsError, setDeathsError] = useState("");
  const [deathsDay, setDeathsDay] = useState("");

  const saveDeaths = async () => {
    const n = Number(deaths);
    if (!Number.isInteger(n) || n <= 0) return setDeathsError("Enter a whole number of birds.");
    setDeathsError("");
    const r = await S.recordMortality({
      batch: deathsFor!,
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
    setError("");
    if (!(await S.addBatch({
      batch: form.batch.trim().toUpperCase(),
      breed: form.breed,
      supplier: form.supplier.trim() || "—",
      received,
      inLay: form.inLay || undefined,
      birds,
      mortality: 0,
      house,
      st: "active",
    })).ok) return;
    setForm({ ...form, batch: "", supplier: "", birds: "", received: "", inLay: "" });
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
        sub="A flock placed — the house fills up straight away"
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
        <FieldRow>
          <TextField
            label="Birds"
            type="number"
            value={form.birds}
            onChange={(v) => setForm({ ...form, birds: v })}
            placeholder="2400"
          />
          <SelectField
            label="House"
            value={house}
            onChange={(v) => setForm({ ...form, house: v })}
            options={[
              ...S.houses.map((h) => ({ label: h.code, value: h.code })),
              { label: "Not in a house yet", value: "—" },
            ]}
          />
        </FieldRow>
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
        <div className="-mt-2 text-[12px] text-[#8b958d]">
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
                <div className="font-display text-[15px] font-bold">{b.batch}</div>
                <Badge label={b.st} bg={s.bg} fg={s.fg} />
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#8b958d]">
                {b.breed} · {b.supplier}
              </div>
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
                    <div className="text-[11.5px] text-[#8b958d]">
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
                  <div className={label}>House</div>
                  {b.st === "active" ? (
                    <select
                      value={b.house}
                      disabled={S.saving}
                      onChange={(e) => {
                        const to = e.target.value;
                        if (window.confirm(`Move ${b.batch} to ${to === "—" ? "no house" : to}?`)) {
                          void S.moveBatch(b.batch, to);
                        }
                      }}
                      className="mt-0.5 rounded-md border border-[#dce1da] bg-white px-1.5 py-1 text-[14px] font-bold"
                    >
                      {S.houses.map((h) => (
                        <option key={h.code} value={h.code}>
                          {h.code}
                        </option>
                      ))}
                      <option value="—">No house</option>
                    </select>
                  ) : (
                    <div className="text-[17px] font-bold">{b.house}</div>
                  )}
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
                        className="font-semibold text-[#2f8f46] underline"
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
                <div className="mt-3.5 flex gap-2 border-t border-[#eef1ec] pt-3">
                  <button
                    onClick={() => {
                      setDeaths("");
                      setDeathsDay("");
                      setDeathsError("");
                      setDeathsFor(b.batch);
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#dce1da] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#2f8f46]"
                  >
                    Birds out
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Close ${b.batch}? It leaves ${b.house} and stops counting as birds in lay.`)) {
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
