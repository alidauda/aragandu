"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

import { presets } from "@/lib/period";
import { Card, CardTitle } from "@/components/erp/ui";

/** Pick a period, then open the printable report or download it as Excel. */
export function FullReportCard({ today, scopeLabel }: { today: string; scopeLabel: string }) {
  const list = presets(today);
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(list[0].from);
  const [to, setTo] = useState(today);
  const query = new URLSearchParams(preset === "custom" ? { from, to } : { period: preset }).toString();

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
      on ? "border-[#055a5b] bg-[#e3efee] text-[#044647]" : "border-[#d6dfde] bg-white text-[#465657] hover:border-[#055a5b]"
    }`;

  return (
    <Card className="mb-5 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Full report</CardTitle>
          <p className="mt-1 max-w-[62ch] text-[13.5px] text-[#5d6b6b]">
            Everything for a period in one document — {scopeLabel.toLowerCase()}: summary, sales, orders, money,
            production, flock, feed, health, the mill and stock. Print it or save as PDF, or download the Excel
            workbook (one sheet per table).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/report?${query}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#044647]"
          >
            <FileText size={16} /> Open report (PDF)
          </a>
          <a
            href={`/api/reports/xlsx?${query}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#055a5b] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
          >
            <FileSpreadsheet size={16} /> Download Excel
          </a>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {list.map((p) => (
          <button key={p.key} type="button" onClick={() => setPreset(p.key)} className={chip(preset === p.key)}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setPreset("custom")} className={chip(preset === "custom")}>
          Custom
        </button>
        {preset === "custom" ? (
          <span className="flex items-center gap-1.5">
            <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="font-data rounded-lg border border-[#d6dfde] bg-white px-2 py-1 text-[12.5px]" aria-label="From" />
            <span className="text-[12.5px] text-[#84908f]">to</span>
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="font-data rounded-lg border border-[#d6dfde] bg-white px-2 py-1 text-[12.5px]" aria-label="To" />
          </span>
        ) : null}
      </div>
    </Card>
  );
}
