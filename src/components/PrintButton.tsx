"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-[10px] bg-[#0d1d1d] px-4 py-2 text-sm font-semibold text-white"
    >
      Print / Save as PDF
    </button>
  );
}
