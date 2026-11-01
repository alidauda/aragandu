"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { monthName, recentMonths } from "@/lib/dates";

/** Monthly summary | Expenses and income | Batch estimate | Feed mill. */
export function FinanceTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/finance", label: "Monthly summary" },
    { href: "/finance/entries", label: "Expenses and income" },
    { href: "/finance/batches", label: "Batch estimate" },
    { href: "/finance/mill", label: "Feed mill" },
  ];
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[#e4eaea]">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${
              on ? "border-[#055a5b] text-[#055a5b]" : "border-transparent text-[#738080] hover:text-[#0d1d1d]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Which month a finance page shows. */
export function MonthSelect({ today, value, onChange }: { today: string; value: string; onChange: (m: string) => void }) {
  return (
    <select
      aria-label="Month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2 text-[14px] font-semibold text-[#0d1d1d]"
    >
      {recentMonths(today).map((m) => (
        <option key={m} value={m}>
          {monthName(`${m}-01`)} {m.slice(0, 4)}
        </option>
      ))}
    </select>
  );
}
