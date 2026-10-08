"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtK, houseOccupancy } from "@/lib/erp/derive";
import { Card, Note, PageHeader } from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  TextField,
} from "@/components/erp/Drawer";

export default function LayersHouses() {
  const S = useErp();
  const rows = houseOccupancy(S.houses, S.batches);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", capacity: "" });

  const [error, setError] = useState("");

  const save = async () => {
    const capacity = Number(form.capacity);
    if (!form.code.trim()) return setError("Enter the house code, e.g. H-04.");
    if (!Number.isInteger(capacity) || capacity <= 0) return setError("Enter the capacity in birds.");
    setError("");
    if (!(await S.addHouse({ code: form.code.trim().toUpperCase(), capacity })).ok) return;
    setForm({ code: "", capacity: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Houses"
        sub="Occupancy derives from batch placement"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            New house
          </NewButton>
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New house"
        sub="Occupancy stays derived — assign batches to fill it"
        onSubmit={save}
        submitLabel="Add house"
      >
        <FieldRow>
          <TextField
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
            placeholder="H-04"
          />
          <TextField
            label="Capacity (birds)"
            type="number"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: v })}
            placeholder="3000"
          />
        </FieldRow>
        <FormError message={error} />
      </Drawer>
      <div className="stagger grid grid-cols-3 gap-3.5">
        {rows.map((h) => {
          const pct = Math.min(100, h.utilisation);
          const tone =
            h.utilisation > 100
              ? "#b3402f"
              : h.utilisation > 85
                ? "#a06a0e"
                : "#3c4d28";
          return (
            <Card key={h.code} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="font-display text-[15px] font-bold">{h.code}</div>
                <div
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: tone }}
                >
                  {h.utilisation.toFixed(0)}%
                </div>
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#8a9070]">
                {h.batch === "—" ? "Empty" : `Batch ${h.batch}`}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef0e4]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: tone }}
                />
              </div>
              <div className="mt-2 text-[12.5px] tabular-nums text-[#6c7359]">
                {fmtK(h.birds)} of {fmtK(h.capacity)} birds
              </div>
            </Card>
          );
        })}
      </div>
      <Note>
        Occupancy derives from the batches assigned to each house — nothing is
        stored on the house.
      </Note>
    </>
  );
}
