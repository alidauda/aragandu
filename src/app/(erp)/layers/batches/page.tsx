"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, stBadge } from "@/lib/erp/derive";
import { Badge, Card, PageHeader } from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";

const label = "text-[11px] uppercase tracking-[1px] text-[#79815f]";

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
  });
  // "—" = not placed in a house yet.
  const house = form.house === "—" || S.houses.some((h) => h.code === form.house)
    ? form.house
    : (S.houses[0]?.code ?? "—");

  const [deathsFor, setDeathsFor] = useState<string | null>(null);
  const [deaths, setDeaths] = useState("");
  const [deathsError, setDeathsError] = useState("");

  const saveDeaths = async () => {
    const n = Number(deaths);
    if (!Number.isInteger(n) || n <= 0) return setDeathsError("Enter a whole number of birds.");
    setDeathsError("");
    const r = await S.recordMortality({ batch: deathsFor!, birds: n });
    if (!r.ok) return setDeathsError(r.error);
    setDeathsFor(null);
  };

  const save = async () => {
    const birds = Number(form.birds);
    if (!form.batch.trim()) return setError("Enter the batch number.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the number of birds.");
    setError("");
    if (!(await S.addBatch({
      batch: form.batch.trim().toUpperCase(),
      breed: form.breed,
      supplier: form.supplier.trim() || "—",
      received: S.today,
      birds,
      mortality: 0,
      house,
      st: "active",
    })).ok) return;
    setForm({ ...form, batch: "", supplier: "", birds: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Batches"
        sub="Flocks placed — birds now, mortality, house"
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
        sub="A flock placed — house occupancy re-derives immediately"
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
        <FormError message={error} />
      </Drawer>

      <Drawer
        open={deathsFor !== null}
        onClose={() => setDeathsFor(null)}
        title={`Record deaths — ${deathsFor ?? ""}`}
        sub="Deaths and culls since the last entry; they're added to the batch's mortality"
        onSubmit={() => void saveDeaths()}
        submitLabel="Record"
      >
        <TextField
          label="Birds"
          type="number"
          value={deaths}
          onChange={setDeaths}
          placeholder="3"
        />
        <FormError message={deathsError} />
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
              <div className="mt-0.5 text-[12.5px] text-[#8a9070]">
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
                  <div className={label}>Mortality</div>
                  <div className="font-data text-[17px] font-bold text-[#b3402f]">
                    {b.mortality}
                  </div>
                </div>
                <div>
                  <div className={label}>House</div>
                  <div className="text-[17px] font-bold">{b.house}</div>
                </div>
                <div>
                  <div className={label}>Received</div>
                  <div className="font-data text-sm font-semibold">
                    {fmtD(b.received)} {b.received.slice(0, 4)}
                  </div>
                </div>
              </div>
              {b.st === "active" ? (
                <div className="mt-3.5 flex gap-2 border-t border-[#f0f1e6] pt-3">
                  <button
                    onClick={() => {
                      setDeaths("");
                      setDeathsError("");
                      setDeathsFor(b.batch);
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#3c4d28]"
                  >
                    Record deaths
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Close ${b.batch}? It leaves ${b.house} and stops counting as birds in lay.`)) {
                        void S.closeBatch(b.batch);
                      }
                    }}
                    disabled={S.saving}
                    className="rounded-lg border border-[#e2c9c3] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#8a5a52]"
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
