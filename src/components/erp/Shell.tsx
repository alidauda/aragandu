"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { areaOf, homeOf, scopeLabel } from "@/lib/access";
import { useErp } from "@/lib/erp/store";
import { Sidebar } from "@/components/erp/Sidebar";
import { TopBar } from "@/components/erp/TopBar";

/** Sidebar + top bar + page, sharing the phone menu's open state. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const S = useErp();
  const pathname = usePathname();
  const router = useRouter();
  const area = areaOf(pathname);
  // Someone in one division starts on their division's home, not the farm dashboard.
  const toHome = area === "dashboard" && S.scope !== null;
  useEffect(() => {
    if (toHome) router.replace(homeOf(S.scope));
  }, [toHome, S.scope, router]);
  const allowed = toHome || S.can(area);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={menu} onClose={close} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <TopBar onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-7 md:px-8 md:pt-9">
          {allowed ? (
            toHome ? null : children
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-[#e7ebe6] bg-white p-8 text-center">
              <div className="font-display text-[20px] font-bold text-[#14231a]">Not part of your division</div>
              <p className="mt-2 text-[14px] text-[#647067]">
                You work in {scopeLabel(S.scope)}. This page belongs to another part of the farm.
              </p>
              <Link
                href={homeOf(S.scope)}
                className="mt-5 inline-block rounded-[10px] bg-[#2f8f46] px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                Go to {scopeLabel(S.scope)}
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
