"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Registered buyers | Walk-in buyers. */
export function CustomerTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/customers", label: "Registered buyers" },
    { href: "/customers/walk-in", label: "Walk-in buyers" },
  ];
  return (
    <div className="mb-4 flex gap-1 border-b border-[#e4eaea]">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[14px] font-semibold transition-colors ${
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
