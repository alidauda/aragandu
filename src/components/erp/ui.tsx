"use client";

import { longDate } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";

/**
 * AFEMS primitives. Identity: chaff canvas, white cards on #dfe2d2 rules,
 * Sora display, Source Sans body — and the signature: figures speak in the
 * ledger mono, and a DERIVED figure carries the bookkeeper's total mark
 * (short double rule) with its arithmetic written beneath.
 */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-[#dfe2d2] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]">
      {children}
    </div>
  );
}

/**
 * A headline figure. Pass `formula` when the number is derived — it renders
 * the total mark and the working underneath, e.g. "300 in − 6 out − 123 sold".
 */
export function Kpi({
  label,
  value,
  sub,
  formula,
  color = "#3c4d28",
}: {
  label: string;
  value: string;
  sub?: string;
  formula?: string;
  color?: string;
}) {
  return (
    <Card className="px-4 py-3.5">
      <Eyebrow>{label}</Eyebrow>
      <div
        className="font-data mt-1.5 text-[21px] font-semibold"
        style={{ color }}
      >
        {value}
      </div>
      {formula ? (
        <>
          <div className="total-mark" />
          <div className="font-data mt-1.5 text-[11px] text-[#8a9070]">
            {formula}
          </div>
        </>
      ) : null}
      {sub ? (
        <div className="mt-1 text-xs text-[#6c7359]">{sub}</div>
      ) : null}
    </Card>
  );
}

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-[3px] text-[11px] font-bold capitalize"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-display text-[15px] font-semibold text-[#1c2214]">
      {children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-2.5 text-[12.5px] text-[#8a9070]">{children}</div>;
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
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f] ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** Right-aligned cells are figures — they automatically take the ledger mono. */
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
      className={`px-4 py-[11px] ${
        right ? "font-data text-right text-[12.5px]" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse text-[13.5px]">{children}</table>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#dfe2d2] bg-[#f7f8ef]">{children}</tr>
    </thead>
  );
}

export function TRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-t border-[#f0f1e6] transition-colors hover:bg-[#f9faf1]">
      {children}
    </tr>
  );
}

/**
 * Page chrome. The eyebrow names the division (structure as information —
 * the title is free to name the actual section).
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
  const { today } = useErp();
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <div className="font-display mt-0.5 text-[22px] font-semibold text-[#1c2214]">
          {title}
        </div>
        <div className="mt-0.5 text-[13.5px] text-[#6c7359]">{sub}</div>
      </div>
      <div className="flex items-center gap-2.5">
        {action}
        <div className="rounded-full border border-[#dfe2d2] bg-white px-3.5 py-1.5 text-[13px] text-[#6c7359]">
          {longDate(today)}
        </div>
      </div>
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
      className="rounded-lg border-none px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
      style={{ background: off ? "#b9c0a8" : "#3c4d28" }}
    >
      {children}
    </button>
  );
}
