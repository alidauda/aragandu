"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
    >
      Print / Save as PDF
    </button>
  );
}
