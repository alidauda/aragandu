/**
 * Who may see and do what. A team member holds a set of roles (Grants):
 *   - a level in any of the farm's divisions (Layers admin, Feed mill staff…),
 *   - optionally a whole-farm level (every division at that level),
 *   - cross-division roles: Sales, Accounts, Store keeper, Reports viewer,
 *   - and one person is the owner, above everyone.
 * Their level in each part of the ERP (an Area) is the best any of their
 * roles gives. Used on both sides: the server cuts each person's data and
 * refuses what they may not do; the client hides the rest of the menu.
 */

export const DIVISION_SCOPES = ["layers", "feed", "broilers", "ruminants"] as const;
export type DivisionScope = (typeof DIVISION_SCOPES)[number];

export const SCOPE_LABEL: Record<DivisionScope, string> = {
  layers: "Layers (chicken)",
  feed: "Feed mill",
  broilers: "Broilers",
  ruminants: "Ruminants",
};

export const FUNCTION_ROLES = ["sales", "accounts", "store", "reports"] as const;
export type FunctionRole = (typeof FUNCTION_ROLES)[number];

export const FUNCTION_LABEL: Record<FunctionRole, string> = {
  sales: "Sales",
  accounts: "Accounts",
  store: "Store keeper",
  reports: "Reports viewer",
};

export const FUNCTION_HELP: Record<FunctionRole, string> = {
  sales: "Buyers, egg orders and sales, feed sales and invoices across every division; sees payments",
  accounts: "Money across the farm — payments, advances, refunds — and every report",
  store: "Inventory at every location: receipts, moves and the catalogue",
  reports: "Every report, read-only",
};

export type TeamLevel = "admin" | "staff";

export type Grants = {
  owner: boolean;
  /** Every division at this level (null: none). */
  farm: TeamLevel | null;
  divisions: Partial<Record<DivisionScope, TeamLevel>>;
  functions: FunctionRole[];
};

export const NO_GRANTS: Grants = { owner: false, farm: null, divisions: {}, functions: [] };

/** Parts of the ERP. */
export type Area =
  | "dashboard"
  /** Layers operations: production, egg store, flock, houses, feed, health, water. */
  | "layers"
  /** Egg buyers, egg orders, egg sales and invoices. */
  | "eggsales"
  /** Feed mill operations: ingredients, deliveries, runs, products, capacity. */
  | "feed"
  /** Feed sales (finished feed). */
  | "feedsales"
  /** Asking the mill for feed (and, for the mill, answering). */
  | "requests"
  /** Payments, advances, refunds, credit and the Payments page. */
  | "money"
  | "inventory"
  | "reports"
  | "team"
  | "activity"
  | "emails";

/** view < staff < admin. */
export type Level = "view" | TeamLevel;
const RANK: Record<Level, number> = { view: 1, staff: 2, admin: 3 };
const best = (a: Level | null, b: Level | null) => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);
const lead = (l: TeamLevel): Level => (l === "admin" ? "admin" : "view");

/** What each role gives, area by area. */
function areasOf(g: Grants): Partial<Record<Area, Level>> {
  const out: Partial<Record<Area, Level>> = {};
  const give = (m: Partial<Record<Area, Level>>) => {
    for (const [a, l] of Object.entries(m) as [Area, Level][]) out[a] = best(out[a] ?? null, l) ?? undefined;
  };
  const d = g.divisions;
  if (d.layers) {
    const l = d.layers;
    give({ layers: l, eggsales: l, money: lead(l), requests: l, inventory: l, reports: "view", team: lead(l) });
  }
  if (d.feed) {
    const l = d.feed;
    give({ feed: l, feedsales: l, requests: l, inventory: l, reports: "view", team: lead(l) });
  }
  for (const dv of ["broilers", "ruminants"] as const) {
    if (d[dv]) give({ requests: d[dv]!, inventory: d[dv]!, team: lead(d[dv]!) });
  }
  for (const f of g.functions) {
    if (f === "sales") give({ eggsales: "staff", feedsales: "staff", money: "view", reports: "view" });
    if (f === "accounts") give({ money: "admin", eggsales: "view", feedsales: "view", reports: "view" });
    if (f === "store") give({ inventory: "admin" });
    if (f === "reports") give({ reports: "view" });
  }
  return out;
}

/** Someone's level in an area, or null if they can't see it. */
export function levelIn(g: Grants, area: Area): Level | null {
  if (g.owner || g.farm === "admin") return "admin";
  // The audit trail and the email log are for the owner and farm-wide admins.
  if (area === "activity" || area === "emails") return null;
  const own = areasOf(g)[area] ?? null;
  if (g.farm === "staff") {
    const farm: Level = area === "money" || area === "team" ? "view" : "staff";
    return best(own, farm);
  }
  if (area === "dashboard") return null;
  return own;
}

/** May they open the area at all / act in it at this level? */
export const canSee = (g: Grants, area: Area) => levelIn(g, area) !== null;
export const canAct = (g: Grants, area: Area, need: TeamLevel = "staff") => {
  const l = levelIn(g, area);
  return l !== null && RANK[l] >= RANK[need];
};

/** The whole farm: the owner and farm-wide members. */
export const isFarmWide = (g: Grants) => g.owner || g.farm !== null;

/** Any admin role at all (the team "role" kept on the login). */
export const hasAdminRole = (g: Grants) =>
  g.owner || g.farm === "admin" || Object.values(g.divisions).includes("admin");

/**
 * Whether `me` may hand out (or take away) these roles. The owner: any.
 * Farm-wide admins: any staff-level role. A division admin: staff in the
 * divisions they run. Admin roles are the owner's to give.
 */
export function mayGrant(me: Grants, g: Grants) {
  if (me.owner) return true;
  if (g.farm === "admin" || Object.values(g.divisions).includes("admin")) return false;
  if (me.farm === "admin") return true;
  if (g.farm || g.functions.length) return false;
  return (Object.keys(g.divisions) as DivisionScope[]).every((d) => me.divisions[d] === "admin");
}

/** No roles at all. */
export const noRoles = (g: Grants) => !g.farm && Object.keys(g.divisions).length === 0 && g.functions.length === 0;

/** Inventory locations they work with — null for every location. */
export function locationsOf(g: Grants): string[] | null {
  if (isFarmWide(g) || g.functions.includes("store")) return null;
  return DIVISION_SCOPES.filter((d) => g.divisions[d]);
}

/** Divisions they raise feed requests for — null for any (the mill answers all). */
export function requestDivisionsOf(g: Grants): string[] | null {
  if (isFarmWide(g) || g.divisions.feed) return null;
  return (["layers", "broilers", "ruminants"] as const).filter((d) => g.divisions[d]);
}

/** Where someone lands. */
export function homeOf(g: Grants) {
  if (isFarmWide(g)) return "/";
  if (g.divisions.layers) return "/layers";
  if (g.divisions.feed) return "/feed";
  if (g.functions.includes("sales")) return "/layers/sales";
  if (g.functions.includes("accounts")) return "/payments";
  if (g.functions.includes("store")) return "/inventory";
  if (g.divisions.broilers || g.divisions.ruminants) return "/feed/requests";
  return "/reports";
}

/** Short labels for every role they hold: "Owner", "Layers admin", "Sales". */
export function roleLabels(g: Grants): string[] {
  const out: string[] = [];
  if (g.owner) out.push("Owner");
  if (g.farm) out.push(`Whole farm ${g.farm}`);
  for (const d of DIVISION_SCOPES) {
    const l = g.divisions[d];
    if (l) out.push(`${SCOPE_LABEL[d].replace(" (chicken)", "")} ${l}`);
  }
  for (const f of g.functions) out.push(FUNCTION_LABEL[f]);
  return out;
}

/** Reads stored grants (JSON), tolerating anything malformed. */
export function asGrants(v: unknown, owner = false): Grants {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const lvl = (x: unknown): TeamLevel | null => (x === "admin" || x === "staff" ? x : null);
  const divisions: Grants["divisions"] = {};
  const raw = (o.divisions && typeof o.divisions === "object" ? o.divisions : {}) as Record<string, unknown>;
  for (const d of DIVISION_SCOPES) {
    const l = lvl(raw[d]);
    if (l) divisions[d] = l;
  }
  const functions = Array.isArray(o.functions)
    ? FUNCTION_ROLES.filter((f) => (o.functions as unknown[]).includes(f))
    : [];
  return { owner, farm: lvl(o.farm), divisions, functions };
}

/** The stored form (owner lives on its own column). */
export const grantsJson = (g: Grants) => ({ farm: g.farm, divisions: g.divisions, functions: g.functions });

/** The area a URL belongs to. */
export function areaOf(pathname: string): Area {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/layers/orders") || pathname.startsWith("/layers/sales")) return "eggsales";
  if (pathname.startsWith("/layers")) return "layers";
  if (pathname.startsWith("/feed/requests")) return "requests";
  if (pathname.startsWith("/feed/finished")) return "feedsales";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/customers") || pathname.startsWith("/invoices")) return "eggsales";
  if (pathname.startsWith("/payments")) return "money";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/reports") || pathname.startsWith("/report")) return "reports";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/emails")) return "emails";
  return "dashboard";
}
