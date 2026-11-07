"use client";

import { useState } from "react";

import { speciesOf } from "@/lib/erp/broilers";
import type { Animal } from "@/lib/erp/types";

/** Ticking animals by tag: search, filter by species, select the shown ones. */
export function AnimalPicker({
  animals,
  value,
  onChange,
  label = "Animals",
}: {
  animals: Animal[];
  value: number[];
  onChange: (ids: number[]) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const shown = animals.filter((a) => !q.trim() || `${a.tag} ${a.pen} ${a.breed}`.toLowerCase().includes(q.trim().toLowerCase()));
  const picked = new Set(value);
  const flip = (ids: number[], on: boolean) => {
    const next = new Set(picked);
    ids.forEach((i) => (on ? next.add(i) : next.delete(i)));
    onChange([...next]);
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-[#465657]">
        <span>
          {label} · {value.length} chosen
        </span>
        <button type="button" onClick={() => flip(shown.map((a) => a.id), !shown.every((a) => picked.has(a.id)))} className="text-[#055a5b] underline">
          {shown.length && shown.every((a) => picked.has(a.id)) ? "Clear shown" : "Choose all shown"}
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tag, pen or breed"
        aria-label="Search animals"
        className="mb-2 w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#055a5b]"
      />
      <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-[#e4eaea]">
        {shown.length === 0 ? <div className="px-3 py-2 text-[13px] text-[#84908f]">No animals match.</div> : null}
        {shown.map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-2.5 border-b border-[#f0f3f3] px-3 py-1.5 text-[13.5px] last:border-0">
            <input type="checkbox" checked={picked.has(a.id)} onChange={(e) => flip([a.id], e.target.checked)} className="size-4 accent-[#055a5b]" />
            <span className="font-semibold">{a.tag}</span>
            <span className="text-[#84908f]">
              {speciesOf(a.species).one} · {a.sex}
              {a.pen ? ` · ${a.pen}` : ""}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
