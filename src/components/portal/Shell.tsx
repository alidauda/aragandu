"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Egg, KeyRound, LayoutGrid, LogOut, Menu, Wallet, type LucideIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { longDate } from "@/lib/dates";
import { BrandBadge } from "@/components/Logo";
import { PasswordDialog } from "@/components/Portal";

/**
 * The buyer's side of the farm: the same white sidebar and top bar as the
 * ERP, with just their own Dashboard, Orders and Payments.
 */

type Item = { label: string; href: string; icon: LucideIcon; count?: number };

const itemCls = (active: boolean) =>
  `relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14.5px] transition-colors ${
    active
      ? "bg-[#e3efee] font-semibold text-[#044647]"
      : "font-medium text-[#465657] hover:bg-[#f4f6f5] hover:text-[#0d1d1d]"
  }`;

function Count({ n, tone = "green" }: { n?: number; tone?: "green" | "amber" }) {
  if (!n) return null;
  return (
    <span
      className={`ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-white ${
        tone === "amber" ? "bg-[#c98a1b]" : "bg-[#055a5b]"
      }`}
    >
      {n}
    </span>
  );
}

export function PortalShell({
  name,
  email,
  today,
  pendingOrders,
  unpaidInvoices,
  children,
}: {
  name: string;
  email: string;
  today: string;
  pendingOrders: number;
  unpaidInvoices: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  // A tap on a link closes the phone menu.
  useEffect(() => setMenu(false), [pathname]);

  const items: (Item & { tone?: "green" | "amber" })[] = [
    { label: "Dashboard", href: "/portal", icon: LayoutGrid },
    { label: "Orders", href: "/portal/orders", icon: Egg, count: pendingOrders, tone: "amber" },
    { label: "Payments", href: "/portal/payments", icon: Wallet, count: unpaidInvoices, tone: "amber" },
  ];

  const signOut = async () => {
    await authClient.signOut();
    router.push("/portal");
    router.refresh();
  };

  return (
    // The buyer portal is Argandu Poultry's: its red and its chicken-feet pattern.
    <div className="flex h-screen overflow-hidden" style={{ ["--division" as string]: "#d62f2f" }}>
      {menu ? (
        <button
          aria-label="Close menu"
          onClick={() => setMenu(false)}
          className="fixed inset-0 z-40 bg-[#0d1d1d]/30 lg:hidden"
        />
      ) : null}
      <nav
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-[#e4eaea] bg-white px-5 pb-5 transition-transform lg:static lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/portal" className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#ebf0ef]">
          <BrandBadge tone="poultry" division="POULTRY" height={34} />
          <span className="font-sub text-[13.5px] leading-tight text-[#5d6b6b]">Buyer portal</span>
        </Link>

        <div className="mt-5 flex flex-col gap-0.5">
          {items.map((it) => {
            const active = pathname === it.href;
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className={itemCls(active)} aria-current={active ? "page" : undefined}>
                {active ? (
                  <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#055a5b]" />
                ) : null}
                <Icon size={19} strokeWidth={1.9} className="shrink-0" />
                {it.label}
                <Count n={it.count} tone={it.tone} />
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 pt-6">
          <div className="mb-1 px-3 text-[12.5px] font-medium text-[#84908f]">Account</div>
          <button onClick={() => setPwOpen(true)} className={itemCls(false)}>
            <KeyRound size={19} strokeWidth={1.9} className="shrink-0" />
            Change password
          </button>
          <button onClick={() => void signOut()} className={itemCls(false)}>
            <LogOut size={19} strokeWidth={1.9} className="shrink-0" />
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e4eaea] bg-white/90 px-4 backdrop-blur md:px-8">
          <button
            onClick={() => setMenu(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#e4eaea] text-[#465657] lg:hidden"
          >
            <Menu size={19} />
          </button>
          <div className="hidden items-center gap-2 rounded-[10px] border border-[#e4eaea] px-3 py-2 text-[13.5px] text-[#465657] sm:flex">
            <CalendarDays size={16} className="text-[#84908f]" />
            {longDate(today)}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e3efee] text-[14px] font-bold text-[#044647]">
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[14.5px] font-semibold text-[#0d1d1d]">{name}</span>
              <span className="block text-[12.5px] text-[#84908f]">{email}</span>
            </span>
          </div>
        </header>
        <div className="pattern-poultry h-2 shrink-0" aria-hidden />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-14 pt-7 md:px-8 md:pt-9">{children}</main>
      </div>

      {pwOpen ? <PasswordDialog onClose={() => setPwOpen(false)} /> : null}
    </div>
  );
}
