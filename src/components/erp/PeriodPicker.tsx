"use client";

import Link from "next/link";
import { useState } from "react";

import { presets, type Period } from "@/lib/period";

/**
 * Quick periods as chips, or any from–to range. The choice lives in the URL
 * (?period=… or ?from=…&to=…), so a view can be bookmarked or shared.
 * `keep` carries other filters along.
 */
export function PeriodPicker({
  path,
  period,
  today,
  keep = {},
}: {
  path: string;
  period: Period;
  today: string;
  keep?: Record<string, string>;
}) {
  const [from, setFrom] = useState(period.from === "2000-01-01" ? "" : period.from);
  const [to, setTo] = useState(period.to);
  const href = (q: Record<string, string>) => `${path}?${new URLSearchParams({ ...keep, ...q })}`;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {presets(today).map((p) => (
        <Link
          key={p.key}
          href={href({ period: p.key })}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
            period.preset === p.key
              ? "border-[#055a5b] bg-[#e3efee] text-[#044647]"
              : "border-[#d6dfde] bg-white text-[#465657] hover:border-[#055a5b]"
          }`}
        >
          {p.label}
        </Link>
      ))}
      <form action={path} className="flex items-center gap-1.5">
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          type="date"
          name="from"
          value={from}
          max={today}
          onChange={(e) => setFrom(e.target.value)}
          className="font-data rounded-lg border border-[#d6dfde] bg-white px-2 py-1 text-[12.5px]"
          aria-label="From"
        />
        <span className="text-[12.5px] text-[#84908f]">to</span>
        <input
          type="date"
          name="to"
          value={to}
          max={today}
          onChange={(e) => setTo(e.target.value)}
          className="font-data rounded-lg border border-[#d6dfde] bg-white px-2 py-1 text-[12.5px]"
          aria-label="To"
        />
        <button
          type="submit"
          disabled={!from || !to}
          className="rounded-lg bg-[#055a5b] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Go
        </button>
      </form>
    </div>
  );
}
