"use client";

/** "Print / Save as PDF" — hidden on the printout itself. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white print:hidden"
    >
      {label}
    </button>
  );
}
