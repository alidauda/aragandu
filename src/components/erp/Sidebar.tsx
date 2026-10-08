"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BellRing,
  ChevronRight,
  Egg,
  History,
  LayoutGrid,
  LogOut,
  Package,
  Sprout,
  UserCog,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { useErp } from "@/lib/erp/store";

/**
 * The white sidebar: icon + label per section, divisions as expandable
 * groups, field-green for where you are and for work that's waiting.
 */

type Leaf = { label: string; href: string; icon?: LucideIcon };
type Group = { label: string; base: string; icon: LucideIcon; items: Leaf[] };

const TOP: Leaf = { label: "Dashboard", href: "/", icon: LayoutGrid };

const GROUPS: Group[] = [
  {
    label: "Layers",
    base: "/layers",
    icon: Egg,
    items: [
      { label: "Overview", href: "/layers" },
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
    label: "Feed mill",
    base: "/feed",
    icon: Wheat,
    items: [
      { label: "Overview", href: "/feed" },
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
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UserCog },
];

/** Admin-only links. */
const ADMIN: Leaf[] = [{ label: "Activity", href: "/activity", icon: History }];

/** Every page, for the top bar's search. */
export const ALL_PAGES: { label: string; href: string; section: string }[] = [
  { label: TOP.label, href: TOP.href, section: "Overview" },
  ...GROUPS.flatMap((g) =>
    g.items.map((i) => ({
      label: i.label === "Overview" ? `${g.label} overview` : i.label,
      href: i.href,
      section: g.label,
    }))
  ),
  ...BOTTOM.map((i) => ({ label: i.label, href: i.href, section: "Shared" })),
];

/** Work waiting behind a link: pending orders and feed requests. */
function usePending(href: string) {
  const { orders, reqs } = useErp();
  if (href === "/layers/orders") return orders.filter((o) => o.status === "pending").length;
  if (href === "/feed/requests") return reqs.filter((q) => q.status === "pending").length;
  return 0;
}

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-[#2f8f46] px-1.5 text-center text-[11px] font-bold leading-5 text-white">
      {n}
    </span>
  );
}

const itemCls = (active: boolean) =>
  `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] transition-colors ${
    active
      ? "bg-[#eaf5ec] font-semibold text-[#1f6e35]"
      : "font-medium text-[#4c5a51] hover:bg-[#f4f6f3] hover:text-[#14231a]"
  }`;

/** The field-green tick on the active row's left edge. */
const ActiveBar = () => (
  <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#2f8f46]" />
);

function LeafLink({ item }: { item: Leaf }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link href={item.href} className={itemCls(active)} aria-current={active ? "page" : undefined}>
      {active ? <ActiveBar /> : null}
      {Icon ? <Icon size={19} strokeWidth={1.9} className="shrink-0" /> : null}
      {item.label}
    </Link>
  );
}

function SubLink({ item }: { item: Leaf }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const pending = usePending(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center rounded-lg px-3 py-[7px] text-[13.5px] transition-colors ${
        active
          ? "bg-[#eaf5ec] font-semibold text-[#1f6e35]"
          : "text-[#647067] hover:bg-[#f4f6f3] hover:text-[#14231a]"
      }`}
    >
      {item.label}
      <Count n={pending} />
    </Link>
  );
}

function DivisionGroup({ group }: { group: Group }) {
  const pathname = usePathname();
  const S = useErp();
  const inside = pathname.startsWith(group.base);
  const waiting =
    group.base === "/layers"
      ? S.orders.filter((o) => o.status === "pending").length
      : S.reqs.filter((q) => q.status === "pending").length;
  // Open when you're inside it; still user-toggleable either way.
  const [open, setOpen] = useState(inside);
  const expanded = open || inside;
  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
        className={itemCls(inside && !expanded) + " w-full"}
      >
        {inside && !expanded ? <ActiveBar /> : null}
        <Icon size={19} strokeWidth={1.9} className="shrink-0" />
        <span className={inside ? "font-semibold text-[#14231a]" : ""}>{group.label}</span>
        {!expanded ? <Count n={waiting} /> : null}
        <ChevronRight
          size={16}
          className={`text-[#8b958d] transition-transform ${expanded ? "rotate-90" : ""} ${
            !expanded && waiting > 0 ? "" : "ml-auto"
          }`}
        />
      </button>
      {expanded ? (
        <div className="mb-1 ml-[22px] mt-0.5 flex flex-col gap-px border-l border-[#e7ebe6] pl-3">
          {group.items.map((it) => (
            <SubLink key={it.href} item={it} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-5 px-3 text-[12.5px] font-medium text-[#8b958d]">{children}</div>;
}

/** Lets the browser pop a notification when a new egg order arrives. */
function AlertsToggle() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => {
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  if (perm !== "default") return null;
  return (
    <button
      onClick={() => void Notification.requestPermission().then(setPerm)}
      className="mb-2 flex w-full items-center gap-2.5 rounded-[10px] bg-[#f4f6f3] px-3 py-2.5 text-left text-[13px] font-medium text-[#4c5a51] hover:text-[#14231a]"
    >
      <BellRing size={17} className="shrink-0 text-[#2f8f46]" />
      Alert me about new orders
    </button>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAdmin } = useErp();
  const pathname = usePathname();
  const router = useRouter();
  // A tap on a link closes the phone menu.
  useEffect(() => onClose(), [pathname, onClose]);

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {open ? (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#14231a]/30 lg:hidden"
        />
      ) : null}
      <nav
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col overflow-y-auto border-r border-[#e7ebe6] bg-white px-5 pb-5 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/" className="flex h-[72px] shrink-0 items-center gap-2.5 border-b border-[#eef1ec]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2f8f46] text-white">
            <Sprout size={20} strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[18px] font-extrabold text-[#14231a]">
              Argandu
            </span>
            <span className="block text-[12px] font-medium text-[#8b958d]">Farm ERP</span>
          </span>
        </Link>

        <div className="mt-5 flex flex-col gap-0.5">
          <LeafLink item={TOP} />
          <SectionLabel>Divisions</SectionLabel>
          {GROUPS.map((g) => (
            <DivisionGroup key={g.base} group={g} />
          ))}
          <SectionLabel>Across the farm</SectionLabel>
          {BOTTOM.map((it) => (
            <LeafLink key={it.href} item={it} />
          ))}
          {isAdmin ? ADMIN.map((it) => <LeafLink key={it.href} item={it} />) : null}
        </div>

        <div className="mt-auto pt-6">
          <AlertsToggle />
          <button onClick={() => void signOut()} className={itemCls(false) + " w-full"}>
            <LogOut size={19} strokeWidth={1.9} className="shrink-0" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
