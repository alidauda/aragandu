"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { addDays, fmtD } from "@/lib/erp/derive";
import { useErp, useErpSaving } from "@/lib/erp/store";

/**
 * The ERP's form surface: a right-side drawer over a dimmed canvas. One
 * pattern for every "New …" across the app — records land in the ledgers
 * and every derived figure moves.
 */
export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  onSubmit,
  submitLabel = "Save",
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  /** Outside the ERP (the buyer portal), the caller says when it's saving. */
  busy?: boolean;
}) {
  const erpSaving = useErpSaving();
  const saving = busy ?? erpSaving;
  // Never close mid-save: the result (an invite link, an error) would land
  // on a drawer that's gone.
  const close = () => {
    if (!saving) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  // Rendered at <body>: an ancestor with a filter or backdrop blur (like the
  // top bar) would otherwise become the frame and clip a fixed drawer.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 cursor-default bg-[#0d1d1d]/25 backdrop-blur-[1px]"
      />
      <div className="relative m-2 flex h-[calc(100%-16px)] w-[440px] max-w-[94vw] flex-col overflow-y-auto overflow-x-hidden rounded-2xl bg-white px-6 py-6 shadow-[0_24px_60px_-20px_rgba(5,70,71,0.35)]">
        <div className="font-display text-[20px] font-bold text-[#0d1d1d]">{title}</div>
        {sub ? <div className="mt-1 text-[13.5px] text-[#5d6b6b]">{sub}</div> : null}
        <form
          className="mt-5 flex flex-1 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-col gap-4">{children}</div>
          <div className="mt-auto flex gap-2.5 pt-6">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="flex-1 rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#465657] hover:bg-[#f2f6f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#044647] disabled:opacity-50"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

const labelCls = "mb-1.5 text-[13px] font-semibold text-[#465657]";
const inputCls =
  "w-full min-w-0 rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] text-[#0d1d1d] outline-none transition-colors focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block min-w-0">
      <div className={labelCls}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} ${type === "number" ? "font-data" : ""}`}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="block min-w-0">
      <div className={labelCls}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** How far back staff can date a record (the server enforces the same). */
export const BACKDATE_DAYS = 7;

/** The bounds for a record's date: today at the latest; staff a week back. */
export function useDayLimits() {
  const S = useErp();
  return { max: S.today, min: S.isAdmin ? undefined : addDays(S.today, -BACKDATE_DAYS) };
}

/**
 * "Which day is this for?" on a day-to-day record. Today by default; pick an
 * earlier day to catch up on something missed.
 */
export function DayField({
  value,
  onChange,
  label = "Date",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const S = useErp();
  return (
    <label className="block min-w-0">
      <div className={labelCls}>{label}</div>
      <DayInput value={value} onChange={onChange} className={inputCls} />
      {value && value !== S.today ? (
        <div className="mt-1 text-[12px] font-semibold text-[#9a6a12]">Recording for {fmtD(value)}, not today</div>
      ) : null}
    </label>
  );
}

/** The bare date input, for the inline record bars. */
export function DayInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  const S = useErp();
  const { min, max } = useDayLimits();
  return (
    <input
      type="date"
      value={value || S.today}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} font-data ${value && value !== S.today ? "border-[#e0b85a] bg-[#fcf6e8]" : ""}`}
    />
  );
}

/** Two fields side by side. min-w-0 stops long labels/inputs forcing the
 *  grid wider than the drawer. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">{children}</div>;
}

/** The header-area "New …" action every list page carries. */
export function NewButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#044647]"
    >
      {children}
    </button>
  );
}

/** A form's own validation message, shown inside the drawer. */
export function FormError({ message }: { message: string }) {
  return message ? (
    <div className="rounded-[10px] bg-[#fbeae7] px-3 py-2 text-[13px] text-[#a8372a]">{message}</div>
  ) : null;
}
