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
 * eggs #2f8f46, feed #3a8bd6.
 */

const EGGS = "#2f8f46";
const FEED = "#3a8bd6";
const GRID = "#eef1ec";
const MUTED = "#8b958d";

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

/** A smooth line through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(p: { x: number; y: number }[]) {
  if (p.length === 0) return "";
  if (p.length < 3) return p.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ");
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const t = 0.18;
    d += ` C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
  }
  return d;
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
  const xy = pts.map((p) => ({ x: p.x, y: s.y(p.v) }));
  const path = smoothPath(xy);
  const bottom = top + PANEL_H;
  // The area under the line, for the soft fill.
  const area = xy.length > 1 ? `${path} L${xy[xy.length - 1].x},${bottom} L${xy[0].x},${bottom} Z` : "";
  const gradId = `fill-${color.slice(1)}`;
  const gridVals = [s.min + (s.max - s.min) * 0.15, (s.min + s.max) / 2, s.max - (s.max - s.min) * 0.15];

  return (
    <g>
      {/* Panel title with its swatch — identity by text, never color alone. */}
      <circle cx={PAD_L + 4} cy={top - 13} r={4} fill={color} />
      <text
        x={PAD_L + 14}
        y={top - 9.5}
        fontSize={10.5}
        fontWeight={700}
        fill="#14231a"
        fontFamily="var(--font-manrope)"
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
            fontSize={9}
            fill={MUTED}
            textAnchor="end"
            fontFamily="var(--font-manrope)"
          >
            {fmtK(g)}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area ? <path d={area} fill={`url(#${gradId})`} stroke="none" /> : null}
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={s.y(p.v)}
          r={3.6}
          fill="#ffffff"
          stroke={color}
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
          fontSize={10}
          fontWeight={700}
          fill="#14231a"
          fontFamily="var(--font-manrope)"
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
          <div className="mt-0.5 text-xs text-[#8b958d]">
            When the feed line moves and the egg line doesn&apos;t follow, ask why
          </div>
        </div>
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="rounded-lg border border-[#dce1da] bg-white px-3 py-1.5 text-xs font-semibold text-[#4c5a51]"
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
                stroke="#d9ded8"
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
                fontFamily="var(--font-manrope)"
              >
                {fmtD(d.date)}
              </text>
            ))}
          </svg>

          {hovered ? (
            <div
              className="pointer-events-none absolute top-3 z-10 rounded-lg border border-[#e7ebe6] bg-white px-3 py-2 shadow-sm"
              style={{
                left: `${(xOf(hover!) / W) * 100}%`,
                transform:
                  hover! > n / 2 ? "translateX(-108%)" : "translateX(10px)",
              }}
            >
              <div className="text-[11px] font-semibold text-[#4c5a51]">
                {fmtD(hovered.date)}
              </div>
              <div className="font-data mt-1 flex items-center gap-1.5 text-[12px] text-[#14231a]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: EGGS }} />
                {hovered.eggs != null ? `${fmtK(hovered.eggs)} eggs` : "no entry"}
              </div>
              <div className="font-data mt-0.5 flex items-center gap-1.5 text-[12px] text-[#14231a]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FEED }} />
                {hovered.feedKg != null ? `${fmtK(hovered.feedKg)} kg feed` : "no entry"}
              </div>
              {gPerBird != null ? (
                <div className="font-data mt-0.5 text-[11px] text-[#8b958d]">
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
