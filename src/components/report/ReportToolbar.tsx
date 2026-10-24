"use client";

import Link from "next/link";

/** Print / save as PDF, download the Excel workbook, or go back. Hidden when printing. */
export function ReportToolbar({ excelHref, children }: { excelHref: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[1040px] flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/reports" className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2 text-[14px] font-semibold text-[#465657]">
          ← Reports
        </Link>
        <span className="ml-auto" />
        <a
          href={excelHref}
          className="rounded-[10px] border border-[#055a5b] bg-white px-4 py-2 text-[14px] font-semibold text-[#055a5b]"
        >
          Download Excel
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-[10px] bg-[#055a5b] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#044647]"
        >
          Print / save as PDF
        </button>
      </div>
      {children}
    </div>
  );
}
