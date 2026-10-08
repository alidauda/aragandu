"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useErp } from "@/lib/erp/store";

/**
 * The dark-olive sidebar from the approved design, upgraded per review:
 * divisions are EXPANDABLE GROUPS (click Layers → its sections drop down)
 * instead of in-page tabs, and the not-yet-built divisions are gone.
 */

type Leaf = { label: string; href: string };
type Group = { label: string; base: string; items: Leaf[] };

const TOP: Leaf = { label: "Dashboard", href: "/" };

const GROUPS: Group[] = [
  {
    label: "Layers",
    base: "/layers",
    items: [
      { label: "Dashboard", href: "/layers" },
      { label: "Production", href: "/layers/production" },
      { label: "Egg inventory", href: "/layers/egg-inventory" },
      { label: "Egg orders", href: "/layers/orders" },
      { label: "Sales & invoices", href: "/layers/sales" },
      { label: "Batches", href: "/layers/batches" },
      { label: "Houses", href: "/layers/houses" },
      { label: "Feed", href: "/layers/feed" },
      { label: "Health", href: "/layers/health" },
      { label: "Water", href: "/layers/water" },
    ],
  },
  {
    label: "Feed Mill",
    base: "/feed",
    items: [
      { label: "Dashboard", href: "/feed" },
      { label: "Ingredients", href: "/feed/ingredients" },
      { label: "Deliveries", href: "/feed/deliveries" },
      { label: "Production runs", href: "/feed/runs" },
      { label: "Products", href: "/feed/products" },
      { label: "Capacity", href: "/feed/capacity" },
      { label: "Finished & sales", href: "/feed/finished" },
      { label: "Requests", href: "/feed/requests" },
    ],
  },
];

const BOTTOM: Leaf[] = [
  { label: "Inventory", href: "/inventory" },
  { label: "Customers", href: "/customers" },
  { label: "Team", href: "/team" },
];

function LeafLink({ item, exact = true }: { item: Leaf; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className="block rounded-lg px-3 py-[9px] text-sm font-semibold transition-colors hover:text-white"
      style={{
        background: active ? "#39452a" : "transparent",
        color: active ? "#ffffff" : "#b9c0a8",
      }}
    >
      {item.label}
    </Link>
  );
}

function DivisionGroup({ group }: { group: Group }) {
  const pathname = usePathname();
  const inside = pathname.startsWith(group.base);
  // Open when you're inside it; still user-toggleable either way.
  const [open, setOpen] = useState(inside);
  const expanded = open || inside;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-[9px] text-sm font-semibold transition-colors hover:text-white"
        style={{ color: inside ? "#ffffff" : "#b9c0a8", background: "transparent" }}
      >
        {group.label}
        <span
          className="text-[10px] transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          ▶
        </span>
      </button>
      {expanded ? (
        <div className="mb-1 ml-3 flex flex-col gap-px border-l border-[#333c26] pl-2">
          {group.items.map((it) => (
            <SubLink key={it.href} item={it} base={group.base} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SubLink({ item, base }: { item: Leaf; base: string }) {
  const pathname = usePathname();
  // The group's index page only matches exactly; deeper items match exactly too.
  const active = pathname === item.href;
  void base;
  return (
    <Link
      href={item.href}
      className="block rounded-md px-3 py-[7px] text-[13px] font-medium transition-colors hover:text-white"
      style={{
        background: active ? "#39452a" : "transparent",
        color: active ? "#ffffff" : "#9aa287",
      }}
    >
      {item.label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-4 px-3 text-[10.5px] font-semibold uppercase tracking-[1.5px] text-[#6d7558]">
      {children}
    </div>
  );
}

function ViewerCard() {
  const { viewer } = useErp();
  const router = useRouter();
  const initials = viewer.name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-[#333c26] px-2.5 pt-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white"
        style={{ background: "#4a5d33", fontFamily: "var(--font-source-sans)", letterSpacing: "0.5px" }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#e8ebdd]">{viewer.name}</div>
        <button
          onClick={() => void signOut()}
          className="text-[11px] text-[#8a9273] transition-colors hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="flex w-[216px] flex-shrink-0 flex-col overflow-y-auto bg-[#232a19] px-3 pb-4 pt-5 text-[#c3caae]">
      <div className="px-2.5 pb-4">
        <div className="font-display text-xl font-bold tracking-[0.5px] text-white">
          AFEMS
        </div>
        {/* The brand carries the signature: the bookkeeper's double rule. */}
        <div
          className="mt-1.5 h-[5px] w-[26px]"
          style={{
            borderTop: "1px solid #4a5d33",
            borderBottom: "3px double #4a5d33",
          }}
        />
        <div className="mt-1.5 text-[11px] uppercase tracking-[1.5px] text-[#8a9273]">
          Farm ERP
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <LeafLink item={TOP} />
        <SectionLabel>Divisions</SectionLabel>
        {GROUPS.map((g) => (
          <DivisionGroup key={g.base} group={g} />
        ))}
        <SectionLabel>Shared</SectionLabel>
        {BOTTOM.map((it) => (
          <LeafLink key={it.href} item={it} />
        ))}
      </div>

      <ViewerCard />
    </div>
  );
}
