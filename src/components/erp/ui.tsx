"use client";

import { useEffect, useRef } from "react";

import { farmToday } from "@/lib/dates";
import type { EntryKind } from "@/lib/erp/actions";
import { fmtD } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";

/**
 * AFEMS primitives — a field in daylight: white cards on a pale canvas,
 * Manrope throughout, field green for action, figures in tabular digits.
 * Hierarchy shows in radius: cards 16px, controls 10px, pills round.
 */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#e4eaea] bg-white ${className}`}>
      {children}
    </div>
  );
}

/** Where a page sits in the app: "Layers", shown above the title. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  // In the current division's brand colour (teal outside a division).
  return <div className="font-sub text-[14px] text-[var(--division,#055a5b)]">{children}</div>;
}

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/**
 * A headline figure, with an optional icon badge. Pass `formula` when the
 * number is derived — the working is written underneath.
 */
export function Kpi({
  label,
  value,
  sub,
  formula,
  color = "#0d1d1d",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  formula?: string;
  color?: string;
  icon?: IconType;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13.5px] font-medium text-[#465657]">{label}</div>
        {Icon ? (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: `${color === "#0d1d1d" ? "#055a5b" : color}1a`, color: color === "#0d1d1d" ? "#055a5b" : color }}
          >
            <Icon size={17} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div
        className="font-figure mt-1.5 text-[26px] font-bold leading-tight"
        style={{ color }}
      >
        {value}
      </div>
      {formula ? (
        <div className="font-data mt-1 text-[12px] text-[#84908f]">{formula}</div>
      ) : null}
      {sub ? <div className="mt-1 text-[12.5px] text-[#5d6b6b]">{sub}</div> : null}
    </Card>
  );
}

/**
 * The feature figure — deep forest with paddock contours. One per
 * dashboard: the number the page exists to show.
 */
export function ForestTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconType;
}) {
  return (
    <div className="forest-tile rounded-2xl px-5 py-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13.5px] font-medium text-white/75">{label}</div>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-white">
            <Icon size={17} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="font-figure mt-1.5 text-[30px] font-bold leading-tight">
        {value}
      </div>
      {sub ? <div className="mt-1 text-[12.5px] text-white/70">{sub}</div> : null}
    </div>
  );
}

/** A status pill: tinted, with a dot in its own colour. */
export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize"
      style={{ background: bg, color: fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
      {label}
    </span>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sub text-[17px] text-[#0d1d1d]">{children}</div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 max-w-[78ch] text-[13px] text-[#84908f]">{children}</div>;
}

export function Th({
  children,
  right = false,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-[12.5px] font-semibold text-[#738080] ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** Right-aligned cells are figures — their digits line up. */
export function Td({
  children,
  right = false,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-3.5 ${
        right ? "font-data text-right text-[13.5px]" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  const ref = useStackLabels();
  return (
    // On phones each row becomes a card: the first cell is its heading and
    // every other cell sits under its column's name (see .stack-table in
    // globals.css). From sm up it's a table; cells wrap on tablets so it
    // fits, and it scrolls sideways only if it still must.
    <div className="sm:overflow-x-auto">
      <table
        ref={ref}
        className="stack-table w-full border-collapse text-[14px] text-[#0d1d1d] sm:min-w-[600px] xl:[&_td]:whitespace-nowrap sm:[&_th]:whitespace-nowrap"
      >
        {children}
      </table>
    </div>
  );
}

/**
 * Gives each body cell its column's name (data-label) so a phone can show
 * "Status · Paid" once the header row is hidden. Re-labels when rows change.
 */
export function useStackLabels() {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const head = table.tHead?.rows[0];
      const names = head ? [...head.cells].flatMap((c) => Array(c.colSpan).fill(c.textContent?.trim() ?? "")) : [];
      for (const body of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])]) {
        for (const row of body.rows) {
          let col = 0;
          for (const cell of row.cells) {
            const name = cell.colSpan > 1 ? "" : (names[col] ?? "");
            if (cell.dataset.label !== name) cell.dataset.label = name;
            col += cell.colSpan;
          }
        }
      }
    };
    label();
    const watch = new MutationObserver(label);
    watch.observe(table, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);
  return ref;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="bg-[#f2f6f5]">{children}</tr>
    </thead>
  );
}

export function TRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-[#ebf0ef] transition-colors hover:bg-[#f8fafa]">
      {children}
    </tr>
  );
}

/**
 * Page chrome: where you are, then a big plain title — the ChartMogul cut.
 * Today's date lives in the top bar.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="font-display mt-1 text-[28px] font-bold leading-[1.15] text-[#0d1d1d] md:text-[32px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[64ch] text-[14.5px] text-[#5d6b6b]">{sub}</p>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2.5">{action}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { saving } = useErp();
  const off = disabled || saving;
  return (
    <button
      onClick={onClick}
      disabled={off}
      className="rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors"
      style={{ background: off ? "#c0cbca" : "#055a5b" }}
    >
      {children}
    </button>
  );
}

/**
 * The farm's houses as a select. `value` may be "" (nothing picked yet);
 * `useHouse` resolves that to the first house so what's shown is what's sent.
 */
export function HouseSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  className: string;
}) {
  const { houses } = useErp();
  if (houses.length === 0) {
    return (
      <select disabled className={className}>
        <option>No houses yet</option>
      </select>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {houses.map((h) => (
        <option key={h.code} value={h.code}>
          {h.code}
        </option>
      ))}
    </select>
  );
}

/** The picked house, falling back to the first one; "" when there are none. */
export function useHouse(picked: string) {
  const { houses } = useErp();
  return houses.some((h) => h.code === picked) ? picked : (houses[0]?.code ?? "");
}

/**
 * Admin correction for a ledger row. Hidden for staff. A wrong entry is
 * deleted and re-entered; the server refuses if stock would go negative.
 */
export function DeleteButton({
  kind,
  id,
  what,
}: {
  kind: EntryKind;
  id: number;
  /** Shown in the confirm: "Delete the 08 Oct water log?" */
  what: string;
}) {
  const S = useErp();
  if (!S.isAdmin) return null;
  return (
    <button
      onClick={() => {
        if (window.confirm(`Delete ${what}? Re-enter it if it was wrong.`)) {
          void S.deleteEntry(kind, id);
        }
      }}
      disabled={S.saving}
      title="Delete (admin)"
      className="rounded-md px-1.5 text-[12px] font-semibold text-[#c7402f] opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30"
    >
      Delete
    </button>
  );
}

/** "Edit" link for admin-only catalog edits. */
export function EditButton({ onClick }: { onClick: () => void }) {
  const S = useErp();
  if (!S.isAdmin) return null;
  return (
    <button
      onClick={onClick}
      disabled={S.saving}
      className="rounded-md px-1.5 text-[12px] font-semibold text-[#055a5b] opacity-70 transition-opacity hover:opacity-100"
    >
      Edit
    </button>
  );
}

/**
 * When a record was entered, shown under its date. Entered the same day:
 * "recorded 14:32" (or another verb: "placed 14:32"). Entered on a later day (back-dated): "entered 25 Oct,
 * 14:32" in amber, so late entries stand out. Without a date (a catalogue
 * row): "added 12 Oct 2026". Hover for the full time.
 */
export function Recorded({ at, date, verb = "recorded" }: { at?: string; date?: string; verb?: string }) {
  if (!at) return null;
  const t = new Date(at);
  const day = farmToday(t);
  const time = t.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
  const late = date !== undefined && day > date;
  const text =
    date === undefined
      ? `added ${fmtD(day)} ${day.slice(0, 4)}`
      : day === date
        ? `${verb} ${time}`
        : `entered ${fmtD(day)}, ${time}`;
  const full = t.toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
  return (
    <div
      title={`Recorded ${full}`}
      className={`mt-0.5 whitespace-nowrap text-[11.5px] font-normal ${late ? "text-[#9a6a12]" : "text-[#84908f]"}`}
    >
      {text}
    </div>
  );
}
