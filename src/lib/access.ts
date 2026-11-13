/**
 * Who may see and do what. A team member holds a set of roles (Grants):
 *   - a level in any of the farm's divisions (Layers admin, Feed mill staff…),
 *   - or Farm manager: everything on the farm, as an admin,
 *   - or Executive: sees the whole farm and changes nothing,
 *   - cross-division roles: Sales, Accounts, Store keeper, Reports viewer,
 *   - and one person is the owner, above everyone.
 * Their level in each part of the ERP (an Area) is the best any of their
 * roles gives. Used on both sides: the server cuts each person's data and
 * refuses what they may not do; the client hides the rest of the menu.
 */

export const DIVISION_SCOPES = ["layers", "feed", "broilers", "brooding", "ruminants"] as const;
export type DivisionScope = (typeof DIVISION_SCOPES)[number];

export const SCOPE_LABEL: Record<DivisionScope, string> = {
  layers: "Layers (chicken)",
  feed: "Feed mill",
  broilers: "Broilers",
  brooding: "Brooding",
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
  sales: "Sells eggs, birds, processed chicken and feed. Sees buyers, invoices and payments.",
  accounts: "Records payments, advances and refunds. Sees Finance, buyers, sales and reports.",
  store: "Inventory only: stock, movements and the asset register.",
  reports: "Reads Reports and Finance. Changes nothing.",
};

export type TeamLevel = "admin" | "staff";

export type Grants = {
  owner: boolean;
  /** Farm manager ("admin"): every page on the farm, as an admin. Executive ("view"): sees it all, changes nothing. */
  farm: "admin" | "view" | null;
  divisions: Partial<Record<DivisionScope, TeamLevel>>;
  functions: FunctionRole[];
  /**
   * Parts of the farm an admin has turned down for them, whatever their
   * roles give: "view" = look but not change, "none" = hidden. Never the owner.
   */
  limit?: Partial<Record<LimitArea, Limit>>;
};
export type Limit = "view" | "none";

/**
 * The parts of the farm that can be turned down person by person, in menu
 * order: each division's records and its sales apart, then the shared pages.
 */
export const LIMIT_AREAS = [
  "layers",
  "eggsales",
  "broilers",
  "broilersales",
  "brooding",
  "broodingsales",
  "ruminants",
  "ruminantsales",
  "feed",
  "feedsales",
  "requests",
  "inventory",
  "customers",
  "money",
  "finance",
  "reports",
  "team",
] as const;
export type LimitArea = (typeof LIMIT_AREAS)[number];
/** Each part's name, and the pages it holds. */
export const AREA_LABEL: Record<LimitArea, { name: string; pages: string }> = {
  layers: { name: "Layers — daily records", pages: "Daily entry, production, flocks, egg store, feed, health" },
  eggsales: { name: "Layers — sales", pages: "Egg orders, sales & invoices" },
  broilers: { name: "Broilers — daily records", pages: "Daily entry, batches, weighing, feed, health, processing" },
  broilersales: { name: "Broilers — sales", pages: "Live birds and processed chicken" },
  brooding: { name: "Brooding — daily records", pages: "Daily entry, batches, weighing, feed, health, dispatch" },
  broodingsales: { name: "Brooding — sales", pages: "Birds sold from brooding" },
  ruminants: { name: "Ruminants — records", pages: "Animals, weights, health, feed" },
  ruminantsales: { name: "Ruminants — sales", pages: "Animals sold" },
  feed: { name: "Feed mill — production", pages: "Ingredients, deliveries, runs, products" },
  feedsales: { name: "Feed mill — sales", pages: "Finished feed & sales" },
  requests: { name: "Feed requests", pages: "Asking the mill for feed" },
  inventory: { name: "Inventory", pages: "" },
  customers: { name: "Customers", pages: "" },
  money: { name: "Payments", pages: "" },
  finance: { name: "Finance", pages: "" },
  reports: { name: "Reports", pages: "" },
  team: { name: "Team", pages: "" },
};

export const NO_GRANTS: Grants = { owner: false, farm: null, divisions: {}, functions: [] };

/** Parts of the ERP. */
export type Area =
  | "dashboard"
  /** Layers operations: production, egg store, flock, houses, feed, health, water. */
  | "layers"
  /** Egg orders, egg sales and invoices. */
  | "eggsales"
  /** The buyers' register (Customers). */
  | "customers"
  /** Feed mill operations: ingredients, deliveries, runs, products, capacity. */
  | "feed"
  /** Feed sales (finished feed). */
  | "feedsales"
  /** Asking the mill for feed (and, for the mill, answering). */
  | "requests"
  /** Payments, advances, refunds, credit and the Payments page. */
  | "money"
  /** Profit and loss: the monthly summary, expenses, batch and mill costing. */
  | "finance"
  /** Broiler operations: houses, batches, daily records, weighing, feed, health, processing. */
  | "broilers"
  /** Selling broilers: live, and processed (carcass, head and feet, gizzard). */
  | "broilersales"
  /** Brooding chicks: raised, then sent to Layers or Broilers as a new flock. */
  | "brooding"
  /** Selling birds from brooding. */
  | "broodingsales"
  /** Goats, sheep and cattle, each by its tag. */
  | "ruminants"
  /** Selling ruminants. */
  | "ruminantsales"
  | "inventory"
  | "reports"
  | "team"
  | "activity"
  | "emails"
  /** How buyers pay, the farm's bank account, the crate price. */
  | "settings";

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
    give({ layers: l, eggsales: l, customers: l, money: lead(l), requests: l, inventory: l, reports: "view", team: lead(l) });
  }
  if (d.feed) {
    const l = d.feed;
    give({ feed: l, feedsales: l, requests: l, inventory: l, reports: "view", team: lead(l) });
  }
  if (d.broilers) {
    const l = d.broilers;
    // Only a Broilers admin records money; broiler staff don't see the egg buyers' books.
    give({ broilers: l, broilersales: l, requests: l, inventory: l, reports: "view", team: lead(l), ...(l === "admin" ? { money: "admin" as const } : {}) });
  }
  for (const dv of ["brooding", "ruminants"] as const) {
    const l = d[dv];
    const sales = dv === "brooding" ? "broodingsales" : "ruminantsales";
    if (l) give({ [dv]: l, [sales]: l, requests: l, inventory: l, reports: "view", team: lead(l), ...(l === "admin" ? { money: "admin" as const } : {}) });
  }
  for (const f of g.functions) {
    if (f === "sales") give({ eggsales: "staff", customers: "staff", feedsales: "staff", broilersales: "staff", money: "view", reports: "view" });
    if (f === "accounts") give({ money: "admin", finance: "admin", eggsales: "view", customers: "view", feedsales: "view", reports: "view" });
    if (f === "store") give({ inventory: "admin" });
    if (f === "reports") give({ reports: "view", finance: "view" });
  }
  return out;
}

/** The level someone's roles give in an area, before anything is turned down for them. */
function roleLevel(g: Grants, area: Area): Level | null {
  if (g.owner || g.farm === "admin") return "admin";
  // The audit trail, the email log and the farm's settings are for the owner and farm managers.
  if (area === "activity" || area === "emails" || area === "settings") return null;
  // An executive looks at the whole farm — its dashboard, records and money — but not at who works there.
  if (g.farm === "view") return area === "team" ? null : "view";
  // The dashboard is the whole farm at a glance: not for one division's people.
  if (area === "dashboard") return null;
  return areasOf(g)[area] ?? null;
}

/** Someone's level in an area, or null if they can't see it. */
export function levelIn(g: Grants, area: Area): Level | null {
  if (g.owner) return "admin";
  // What an admin turned down for them holds, whatever their roles.
  const cap = g.limit?.[area as LimitArea];
  if (cap === "none") return null;
  const l = roleLevel(g, area);
  return l && cap === "view" ? "view" : l;
}

/** They can look here but not make entries or changes: an admin set it so for them, or they're an executive. */
export const isViewOnly = (g: Grants, area: Area) =>
  !g.owner && (g.limit?.[area as LimitArea] === "view" || g.farm === "view") && levelIn(g, area) === "view";

/** May they open the area at all / act in it at this level? */
export const canSee = (g: Grants, area: Area) => levelIn(g, area) !== null;
export const canAct = (g: Grants, area: Area, need: TeamLevel = "staff") => {
  const l = levelIn(g, area);
  return l !== null && RANK[l] >= RANK[need];
};

/** The whole farm in view: the owner, farm managers and executives. */
export const isFarmWide = (g: Grants) => g.owner || g.farm !== null;

/** Runs the whole farm: the owner and farm managers. */
export const runsFarm = (g: Grants) => g.owner || g.farm === "admin";

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
  return (["layers", "broilers", "brooding", "ruminants"] as const).filter((d) => g.divisions[d]);
}

/** Where someone lands. */
export function homeOf(g: Grants) {
  if (isFarmWide(g)) return "/";
  if (g.divisions.layers) return "/layers";
  if (g.divisions.feed) return "/feed";
  if (g.divisions.broilers) return "/broilers";
  if (g.divisions.brooding) return "/brooding";
  if (g.divisions.ruminants) return "/ruminants";
  if (g.functions.includes("sales")) return "/layers/sales";
  if (g.functions.includes("accounts")) return "/payments";
  if (g.functions.includes("store")) return "/inventory";
  return "/reports";
}

/** Short labels for every role they hold: "Owner", "Layers admin", "Sales". */
export function roleLabels(g: Grants): string[] {
  const out: string[] = [];
  if (g.owner) out.push("Owner");
  if (g.farm && !g.owner) out.push(g.farm === "view" ? "Executive" : "Farm manager");
  // A farm manager, an executive or the owner covers the whole farm: other jobs add nothing.
  if (!g.farm && !g.owner) {
    for (const d of DIVISION_SCOPES) {
      const l = g.divisions[d];
      if (l) out.push(`${SCOPE_LABEL[d].replace(" (chicken)", "")} ${l}`);
    }
      for (const f of g.functions) out.push(FUNCTION_LABEL[f]);
  }
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
  // "Whole farm staff" is no longer a role of its own: it reads as staff in every division.
  if (o.farm === "staff") for (const d of DIVISION_SCOPES) divisions[d] ??= "staff";
  // What was turned down for them. (`deny` is the older list of hidden pages.)
  const limit: Grants["limit"] = {};
  const rawLimit = (o.limit && typeof o.limit === "object" ? o.limit : {}) as Record<string, unknown>;
  for (const a of LIMIT_AREAS) {
    if (rawLimit[a] === "view" || rawLimit[a] === "none") limit[a] = rawLimit[a];
    else if (Array.isArray(o.deny) && (o.deny as unknown[]).includes(a)) limit[a] = "none";
  }
  return { owner, farm: o.farm === "admin" ? "admin" : o.farm === "view" ? "view" : null, divisions, functions, limit };
}

/** The stored form (owner lives on its own column). */
export const grantsJson = (g: Grants) => ({ farm: g.farm, divisions: g.divisions, functions: g.functions, limit: g.limit ?? {} });

/** The parts their roles open, with the level the roles give, before anything is turned down. */
export const limitableOf = (g: Omit<Grants, "owner">) =>
  LIMIT_AREAS.flatMap((area) => {
    const level = roleLevel({ owner: false, ...g }, area);
    return level ? [{ area, level }] : [];
  });

/**
 * Drops limits that do nothing — on parts their roles don't open, or "view"
 * where their roles only give view — so none lingers to surprise a later
 * change of job.
 */
export const tidyLimit = <G extends Omit<Grants, "owner">>(g: G): G => {
  const open = new Map(limitableOf(g).map((x) => [x.area, x.level]));
  const limit: Grants["limit"] = {};
  for (const [a, cap] of Object.entries(g.limit ?? {}) as [LimitArea, Limit][]) {
    if (open.has(a) && !(cap === "view" && open.get(a) === "view")) limit[a] = cap;
  }
  return { ...g, limit };
};

/** What's been turned down for them, in words: "No Inventory", "Layers — sales: view only". */
export const limitLabels = (g: Grants) =>
  g.owner
    ? []
    : LIMIT_AREAS.flatMap((a) =>
        g.limit?.[a] === "none" ? [`No ${AREA_LABEL[a].name}`] : g.limit?.[a] === "view" ? [`${AREA_LABEL[a].name}: view only`] : []
      );

/** The area a URL belongs to. */
export function areaOf(pathname: string): Area {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/layers/orders") || pathname.startsWith("/layers/sales")) return "eggsales";
  if (pathname.startsWith("/layers")) return "layers";
  if (pathname.startsWith("/feed/requests")) return "requests";
  if (pathname.startsWith("/feed/finished")) return "feedsales";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/invoices")) return "eggsales";
  if (pathname.startsWith("/payments")) return "money";
  if (pathname.startsWith("/broilers/sales")) return "broilersales";
  if (pathname.startsWith("/broilers")) return "broilers";
  if (pathname.startsWith("/brooding/sales")) return "broodingsales";
  if (pathname.startsWith("/brooding")) return "brooding";
  if (pathname.startsWith("/ruminants/sales")) return "ruminantsales";
  if (pathname.startsWith("/ruminants")) return "ruminants";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/reports") || pathname.startsWith("/report")) return "reports";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/emails")) return "emails";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}
