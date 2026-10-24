"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Egg, KeyRound, LayoutGrid, LogOut, Menu, Sprout, Wallet, type LucideIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { longDate } from "@/lib/dates";
import { PasswordDialog } from "@/components/Portal";

/**
 * The buyer's side of the farm: the same white sidebar and top bar as the
 * ERP, with just their own Dashboard, Orders and Payments.
 */

type Item = { label: string; href: string; icon: LucideIcon; count?: number };

const itemCls = (active: boolean) =>
  `relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14.5px] transition-colors ${
    active
      ? "bg-[#eaf5ec] font-semibold text-[#1f6e35]"
      : "font-medium text-[#4c5a51] hover:bg-[#f4f6f3] hover:text-[#14231a]"
  }`;

function Count({ n, tone = "green" }: { n?: number; tone?: "green" | "amber" }) {
  if (!n) return null;
  return (
    <span
      className={`ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5 text-white ${
        tone === "amber" ? "bg-[#c98a1b]" : "bg-[#2f8f46]"
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
    { label: "Orders", href: "/portal/orders", icon: Egg, count: pendingOrders },
    { label: "Payments", href: "/portal/payments", icon: Wallet, count: unpaidInvoices, tone: "amber" },
  ];

  const signOut = async () => {
    await authClient.signOut();
    router.push("/portal");
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {menu ? (
        <button
          aria-label="Close menu"
          onClick={() => setMenu(false)}
          className="fixed inset-0 z-40 bg-[#14231a]/30 lg:hidden"
        />
      ) : null}
      <nav
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-[#e7ebe6] bg-white px-5 pb-5 transition-transform lg:static lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/portal" className="flex h-[72px] shrink-0 items-center gap-2.5 border-b border-[#eef1ec]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2f8f46] text-white">
            <Sprout size={20} strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[18px] font-extrabold text-[#14231a]">Argandu</span>
            <span className="block text-[12px] font-medium text-[#8b958d]">Buyer portal</span>
          </span>
        </Link>

        <div className="mt-5 flex flex-col gap-0.5">
          {items.map((it) => {
            const active = pathname === it.href;
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className={itemCls(active)} aria-current={active ? "page" : undefined}>
                {active ? (
                  <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#2f8f46]" />
                ) : null}
                <Icon size={19} strokeWidth={1.9} className="shrink-0" />
                {it.label}
                <Count n={it.count} tone={it.tone} />
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 pt-6">
          <div className="mb-1 px-3 text-[12.5px] font-medium text-[#8b958d]">Account</div>
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
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e7ebe6] bg-white/90 px-4 backdrop-blur md:px-8">
          <button
            onClick={() => setMenu(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#e7ebe6] text-[#4c5a51] lg:hidden"
          >
            <Menu size={19} />
          </button>
          <div className="hidden items-center gap-2 rounded-[10px] border border-[#e7ebe6] px-3 py-2 text-[13.5px] text-[#4c5a51] sm:flex">
            <CalendarDays size={16} className="text-[#8b958d]" />
            {longDate(today)}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eaf5ec] text-[14px] font-bold text-[#1f6e35]">
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[14.5px] font-semibold text-[#14231a]">{name}</span>
              <span className="block text-[12.5px] text-[#8b958d]">{email}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-14 pt-7 md:px-8 md:pt-9">{children}</main>
      </div>

      {pwOpen ? <PasswordDialog onClose={() => setPwOpen(false)} /> : null}
    </div>
  );
}
