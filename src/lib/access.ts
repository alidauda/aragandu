/**
 * Who sees which part of the ERP. A team member is either farm-wide
 * (division = null: the owner, and anyone the owner keeps farm-wide) or
 * belongs to one division and sees only that division's work.
 *
 * Used on both sides: the server cuts each person's data and refuses
 * actions outside their division; the client hides the rest of the menu.
 */

export const DIVISION_SCOPES = ["layers", "feed", "broilers", "ruminants"] as const;
export type DivisionScope = (typeof DIVISION_SCOPES)[number];
/** null = the whole farm. */
export type Scope = DivisionScope | null;

export const SCOPE_LABEL: Record<DivisionScope, string> = {
  layers: "Layers (chicken)",
  feed: "Feed mill",
  broilers: "Broilers",
  ruminants: "Ruminants",
};

export const scopeLabel = (s: Scope) => (s ? SCOPE_LABEL[s] : "Whole farm");

export const asScope = (v: unknown): Scope =>
  typeof v === "string" && (DIVISION_SCOPES as readonly string[]).includes(v) ? (v as DivisionScope) : null;

/** Parts of the ERP, for menus, page guards and action checks. */
export type Area =
  | "dashboard"
  | "layers"
  | "feed"
  /** Asking the feed mill for feed (and, for the mill, answering). */
  | "requests"
  /** Egg buyers, their invoices, payments and credit. */
  | "customers"
  | "inventory"
  | "reports"
  | "team"
  | "activity"
  | "emails";

const DIVISION_AREAS: Record<DivisionScope, Area[]> = {
  layers: ["layers", "customers", "inventory", "reports", "requests", "team"],
  feed: ["feed", "requests", "inventory", "reports", "team"],
  broilers: ["requests", "inventory", "team"],
  ruminants: ["requests", "inventory", "team"],
};

/** Whether someone with this scope may open an area. */
export function canOpen(scope: Scope, area: Area, isAdmin: boolean) {
  // The audit trail and the email log are for farm-wide admins.
  if (area === "activity" || area === "emails") return isAdmin && scope === null;
  if (scope === null) return true;
  return DIVISION_AREAS[scope].includes(area);
}

/** Where someone lands: the dashboard, or their division's home. */
export const homeOf = (scope: Scope) =>
  scope === null ? "/" : scope === "layers" ? "/layers" : scope === "feed" ? "/feed" : "/feed/requests";

/** The inventory location a division keeps its stock in (null = all). */
export const locationOf = (scope: Scope) => scope;

/** The area a URL belongs to. */
export function areaOf(pathname: string): Area {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/feed/requests")) return "requests";
  if (pathname.startsWith("/layers")) return "layers";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/customers") || pathname.startsWith("/invoices")) return "customers";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/emails")) return "emails";
  return "dashboard";
}
