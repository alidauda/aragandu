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
  Mail,
  Package,
  Truck,
  UserCog,
  Wallet,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { areaOf, homeOf, roleLabels, type Area } from "@/lib/access";
import { BrandBadge } from "@/components/Logo";
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
  { label: "Payments", href: "/payments", icon: Wallet },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UserCog },
];

/** Admin-only links. */
const ADMIN: Leaf[] = [
  { label: "Activity", href: "/activity", icon: History },
  { label: "Email log", href: "/emails", icon: Mail },
];

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
  if (href === "/layers/orders") return orders.filter((o) => o.status === "pending" && o.paidAt).length;
  if (href === "/feed/requests") return reqs.filter((q) => q.status === "pending").length;
  return 0;
}

/** For a division that asks the mill for feed but doesn't run it. */
const REQUESTS: Leaf = { label: "Feed requests", href: "/feed/requests", icon: Truck };

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-[#055a5b] px-1.5 text-center text-[11px] font-bold leading-5 text-white">
      {n}
    </span>
  );
}

const itemCls = (active: boolean) =>
  `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] transition-colors ${
    active
      ? "bg-[#e3efee] font-semibold text-[#044647]"
      : "font-medium text-[#465657] hover:bg-[#f4f6f5] hover:text-[#0d1d1d]"
  }`;

/** The field-green tick on the active row's left edge. */
const ActiveBar = () => (
  <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#055a5b]" />
);

function LeafLink({ item }: { item: Leaf }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const pending = usePending(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} className={itemCls(active)} aria-current={active ? "page" : undefined}>
      {active ? <ActiveBar /> : null}
      {Icon ? <Icon size={19} strokeWidth={1.9} className="shrink-0" /> : null}
      {item.label}
      <Count n={pending} />
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
          ? "bg-[#e3efee] font-semibold text-[#044647]"
          : "text-[#5d6b6b] hover:bg-[#f4f6f5] hover:text-[#0d1d1d]"
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
      ? S.orders.filter((o) => o.status === "pending" && o.paidAt).length
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
        {/* Each division's own colour (brand guidelines): poultry red, feed-mill slate. */}
        <Icon
          size={19}
          strokeWidth={1.9}
          className="shrink-0"
          style={{ color: group.base === "/layers" ? "#d62f2f" : group.base === "/feed" ? "#3b465c" : undefined }}
        />
        <span className={inside ? "font-semibold text-[#0d1d1d]" : ""}>{group.label}</span>
        {!expanded ? <Count n={waiting} /> : null}
        <ChevronRight
          size={16}
          className={`text-[#84908f] transition-transform ${expanded ? "rotate-90" : ""} ${
            !expanded && waiting > 0 ? "" : "ml-auto"
          }`}
        />
      </button>
      {expanded ? (
        <div className="mb-1 ml-[22px] mt-0.5 flex flex-col gap-px border-l border-[#e4eaea] pl-3">
          {group.items.map((it) => (
            <SubLink key={it.href} item={it} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-5 px-3 text-[12.5px] font-medium text-[#84908f]">{children}</div>;
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
      className="mb-2 flex w-full items-center gap-2.5 rounded-[10px] bg-[#f4f6f5] px-3 py-2.5 text-left text-[13px] font-medium text-[#465657] hover:text-[#0d1d1d]"
    >
      <BellRing size={17} className="shrink-0 text-[#055a5b]" />
      Alert me about new orders
    </button>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can, grants, farmWide } = useErp();
  const show = (href: string) => can(areaOf(href) as Area);
  // A group shows only the pages their roles reach (a salesperson sees Layers' orders and sales).
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => show(it.href)) })).filter(
    (g) => g.items.length > 0
  );
  const bottom = BOTTOM.filter((it) => show(it.href));
  const only = Object.keys(grants.divisions);
  const badge = farmWide || only.length !== 1 ? "farm" : only[0];
  const caption = farmWide ? "Farm ERP" : (roleLabels(grants)[0] ?? "Farm ERP");
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
          className="fixed inset-0 z-40 bg-[#0d1d1d]/30 lg:hidden"
        />
      ) : null}
      <nav
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col overflow-y-auto border-r border-[#e4eaea] bg-white px-5 pb-5 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href={homeOf(grants)} className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#ebf0ef]">
          {/* A one-division member gets their division's badge; the primary mark otherwise. */}
          {badge === "layers" ? (
            <BrandBadge tone="poultry" division="POULTRY" height={34} />
          ) : badge === "feed" ? (
            <BrandBadge tone="feedmill" division="FEEDMILL" height={34} />
          ) : (
            <BrandBadge height={34} />
          )}
          <span className="font-sub text-[13.5px] leading-tight text-[#5d6b6b]">{caption}</span>
        </Link>

        <div className="mt-5 flex flex-col gap-0.5">
          {farmWide ? <LeafLink item={TOP} /> : null}
          {groups.length ? <SectionLabel>Divisions</SectionLabel> : null}
          {groups.map((g) => (
            <DivisionGroup key={g.base} group={g} />
          ))}
          {/* Divisions that ask the mill for feed but don't run it. */}
          {can("requests") && !can("feed") ? <LeafLink item={REQUESTS} /> : null}
          {bottom.length ? <SectionLabel>Across the farm</SectionLabel> : null}
          {bottom.map((it) => (
            <LeafLink key={it.href} item={it} />
          ))}
          {ADMIN.filter((it) => show(it.href)).map((it) => (
            <LeafLink key={it.href} item={it} />
          ))}
        </div>

        <div className="mt-auto pt-6">
          {can("layers") ? <AlertsToggle /> : null}
          <button onClick={() => void signOut()} className={itemCls(false) + " w-full"}>
            <LogOut size={19} strokeWidth={1.9} className="shrink-0" />
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
