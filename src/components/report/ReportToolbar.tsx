"use client";

import Link from "next/link";

/** Print / save as PDF, download the Excel workbook, or go back. Hidden when printing. */
export function ReportToolbar({ excelHref, children }: { excelHref: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[1040px] flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/reports" className="rounded-[10px] border border-[#dce1da] bg-white px-4 py-2 text-[14px] font-semibold text-[#4c5a51]">
          ← Reports
        </Link>
        <span className="ml-auto" />
        <a
          href={excelHref}
          className="rounded-[10px] border border-[#2f8f46] bg-white px-4 py-2 text-[14px] font-semibold text-[#2f8f46]"
        >
          Download Excel
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-[10px] bg-[#2f8f46] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#27793b]"
        >
          Print / save as PDF
        </button>
      </div>
      {children}
    </div>
  );
}
