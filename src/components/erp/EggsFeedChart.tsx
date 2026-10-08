"use client";

import { useMemo, useRef, useState } from "react";

import type { FeedUse, ProdEntry } from "@/lib/erp/types";
import { addDays, fmtD, fmtK } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, CardTitle, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

/**
 * Eggs vs feed, day by day — the layer farm's diagnostic picture. Two
 * measures of different scale, so NO dual axis: two aligned panels share one
 * x-axis and one crosshair. Series colors are validated (CVD + contrast):
 * eggs #4f8a3a, feed #2f7cb6.
 */

const EGGS = "#4f8a3a";
const FEED = "#2f7cb6";
const GRID = "#f0f1e6";
const MUTED = "#8a9070";

const W = 800;
const PAD_L = 46;
const PAD_R = 16;
const PANEL_H = 96;
const PANEL_GAP = 40;
const TOP = 26;
const X_AXIS_H = 26;
const H = TOP + PANEL_H * 2 + PANEL_GAP + X_AXIS_H;

type Day = { date: string; eggs: number | null; feedKg: number | null };

/** The last 7 calendar days to today; a day with nothing logged is a gap. */
function buildDays(prodLog: ProdEntry[], feedUse: FeedUse[], today: string): Day[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return dates.map((date) => {
    const eggsRows = prodLog.filter((p) => p.date === date);
    const feedRows = feedUse.filter((u) => u.date === date);
    return {
      date,
      eggs: eggsRows.length
        ? eggsRows.reduce((a, p) => a + p.eggs, 0)
        : null,
      feedKg: feedRows.length
        ? feedRows.reduce((a, u) => a + u.kg, 0)
        : null,
    };
  });
}

function scaleY(values: (number | null)[], top: number, height: number) {
  const nums = values.filter((v): v is number => v !== null);
  // No data yet (fresh farm, or eggs logged before any feed): a flat 0–1 axis.
  if (nums.length === 0) {
    return { min: 0, max: 1, y: (v: number) => top + height - v * height };
  }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const pad = (hi - lo) * 0.25 || hi * 0.05 || 1;
  const min = lo - pad;
  const max = hi + pad;
  return {
    min,
    max,
    y: (v: number) => top + height - ((v - min) / (max - min)) * height,
  };
}

function Panel({
  title,
  color,
  days,
  pick,
  top,
  xOf,
  unit,
}: {
  title: string;
  color: string;
  days: Day[];
  pick: (d: Day) => number | null;
  top: number;
  xOf: (i: number) => number;
  unit: string;
}) {
  const s = scaleY(days.map(pick), top, PANEL_H);
  const pts = days
    .map((d, i) => ({ v: pick(d), x: xOf(i) }))
    .filter((p): p is { v: number; x: number } => p.v !== null);
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${s.y(p.v)}`)
    .join(" ");
  const gridVals = [s.min + (s.max - s.min) * 0.15, (s.min + s.max) / 2, s.max - (s.max - s.min) * 0.15];

  return (
    <g>
      {/* Panel title with its swatch — identity by text, never color alone. */}
      <circle cx={PAD_L + 5} cy={top - 13} r={5} fill={color} />
      <text
        x={PAD_L + 16}
        y={top - 9}
        fontSize={11.5}
        fontWeight={600}
        fill="#59614a"
        fontFamily="var(--font-source-sans)"
      >
        {title}
      </text>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={s.y(g)}
            y2={s.y(g)}
            stroke={GRID}
            strokeWidth={1}
          />
          <text
            x={PAD_L - 6}
            y={s.y(g) + 3}
            fontSize={9.5}
            fill={MUTED}
            textAnchor="end"
            fontFamily="var(--font-data)"
          >
            {fmtK(g)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={s.y(p.v)}
          r={4}
          fill={color}
          stroke="#ffffff"
          strokeWidth={2}
        />
      ))}
      {/* Direct label on the last point only — selective, not every point.
          Above the marker and end-anchored so it never clips the right edge. */}
      {pts.length ? (
        <text
          x={Math.min(pts[pts.length - 1].x + 4, W - PAD_R)}
          y={s.y(pts[pts.length - 1].v) - 10}
          textAnchor="end"
          fontSize={10.5}
          fontWeight={600}
          fill="#59614a"
          fontFamily="var(--font-data)"
        >
          {fmtK(pts[pts.length - 1].v)}
          {unit ? ` ${unit}` : ""}
        </text>
      ) : null}
    </g>
  );
}

export function EggsFeedChart({
  prodLog,
  feedUse,
  birds,
}: {
  prodLog: ProdEntry[];
  feedUse: FeedUse[];
  birds: number;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { today } = useErp();
  const days = useMemo(() => buildDays(prodLog, feedUse, today), [prodLog, feedUse, today]);
  const n = days.length;
  const xOf = (i: number) =>
    n === 1
      ? (PAD_L + W - PAD_R) / 2
      : PAD_L + 18 + ((W - PAD_L - PAD_R - 36) * i) / (n - 1);

  const feedTop = TOP + PANEL_H + PANEL_GAP;

  const onMove = (e: React.MouseEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++)
      if (Math.abs(xOf(i) - px) < Math.abs(xOf(best) - px)) best = i;
    setHover(best);
  };

  const hovered = hover !== null ? days[hover] : null;
  const gPerBird =
    hovered?.feedKg != null && birds > 0
      ? Math.round((hovered.feedKg * 1000) / birds)
      : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div>
          <CardTitle>Eggs vs feed — daily</CardTitle>
          <div className="mt-0.5 text-xs text-[#8a9070]">
            When the feed line moves and the egg line doesn&apos;t follow, ask why
          </div>
        </div>
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="rounded-lg border border-[#cfd3bd] bg-white px-3 py-1.5 text-xs font-semibold text-[#59614a]"
        >
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {view === "table" ? (
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th right>Eggs</Th>
              <Th right>Feed (kg)</Th>
              <Th right>g / bird</Th>
            </THead>
            <tbody>
              {[...days].reverse().map((d) => (
                <TRow key={d.date}>
                  <Td>{fmtD(d.date)}</Td>
                  <Td right>{d.eggs != null ? fmtK(d.eggs) : "—"}</Td>
                  <Td right>{d.feedKg != null ? fmtK(d.feedKg) : "—"}</Td>
                  <Td right>
                    {d.feedKg != null && birds > 0
                      ? fmtK((d.feedKg * 1000) / birds)
                      : "—"}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div
          ref={boxRef}
          className="relative px-2 pb-2 pt-1"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {/* Shared crosshair through both panels. */}
            {hover !== null ? (
              <line
                x1={xOf(hover)}
                x2={xOf(hover)}
                y1={TOP - 4}
                y2={feedTop + PANEL_H + 6}
                stroke="#c9cdb6"
                strokeWidth={1}
              />
            ) : null}
            <Panel
              title="Eggs collected"
              color={EGGS}
              days={days}
              pick={(d) => d.eggs}
              top={TOP}
              xOf={xOf}
              unit=""
            />
            <Panel
              title="Feed used (kg)"
              color={FEED}
              days={days}
              pick={(d) => d.feedKg}
              top={feedTop}
              xOf={xOf}
              unit="kg"
            />
            {days.map((d, i) => (
              <text
                key={d.date}
                x={xOf(i)}
                y={H - 8}
                fontSize={10}
                fill={MUTED}
                textAnchor="middle"
                fontFamily="var(--font-data)"
              >
                {fmtD(d.date)}
              </text>
            ))}
          </svg>

          {hovered ? (
            <div
              className="pointer-events-none absolute top-3 z-10 rounded-lg border border-[#dfe2d2] bg-white px-3 py-2 shadow-sm"
              style={{
                left: `${(xOf(hover!) / W) * 100}%`,
                transform:
                  hover! > n / 2 ? "translateX(-108%)" : "translateX(10px)",
              }}
            >
              <div className="text-[11px] font-semibold text-[#59614a]">
                {fmtD(hovered.date)}
              </div>
              <div className="font-data mt-1 flex items-center gap-1.5 text-[12px] text-[#1c2214]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: EGGS }} />
                {hovered.eggs != null ? `${fmtK(hovered.eggs)} eggs` : "no entry"}
              </div>
              <div className="font-data mt-0.5 flex items-center gap-1.5 text-[12px] text-[#1c2214]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FEED }} />
                {hovered.feedKg != null ? `${fmtK(hovered.feedKg)} kg feed` : "no entry"}
              </div>
              {gPerBird != null ? (
                <div className="font-data mt-0.5 text-[11px] text-[#8a9070]">
                  ≈ {gPerBird} g/bird
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
