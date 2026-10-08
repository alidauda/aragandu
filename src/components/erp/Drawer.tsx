"use client";

import { useEffect } from "react";

import { useErp } from "@/lib/erp/store";

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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  const { saving } = useErp();
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 cursor-default bg-[#1c2214]/30"
      />
      <div className="relative flex h-full w-[420px] max-w-[92vw] flex-col overflow-y-auto overflow-x-hidden border-l border-[#dfe2d2] bg-white px-6 py-6 shadow-xl">
        <div className="font-display text-lg font-semibold text-[#1c2214]">
          {title}
        </div>
        {sub ? (
          <div className="mt-1 text-[12.5px] text-[#8a9070]">{sub}</div>
        ) : null}
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
              className="flex-1 rounded-lg border border-[#cfd3bd] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#59614a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#3c4d28] px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelCls =
  "mb-[5px] text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]";
const inputCls =
  "w-full min-w-0 rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-2 text-[13.5px] outline-none";

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
      className="rounded-lg bg-[#3c4d28] px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

/** A form's own validation message, shown inside the drawer. */
export function FormError({ message }: { message: string }) {
  return message ? <div className="text-[12.5px] text-[#b3402f]">{message}</div> : null;
}
