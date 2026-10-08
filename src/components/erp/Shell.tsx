"use client";

import { useCallback, useState } from "react";

import { Sidebar } from "@/components/erp/Sidebar";
import { TopBar } from "@/components/erp/TopBar";

/** Sidebar + top bar + page, sharing the phone menu's open state. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={menu} onClose={close} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <TopBar onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-7 md:px-8 md:pt-9">
          {children}
        </main>
      </div>
    </div>
  );
}
