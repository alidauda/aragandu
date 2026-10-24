import "server-only";

import { headers } from "next/headers";

import { appUrl } from "@/lib/email";

/**
 * The buyer portal can live on its own address (PORTAL_URL, e.g.
 * https://customer.argandufarms.com.ng) while staff use BETTER_AUTH_URL.
 * There, the portal is the whole site: "/" is its home, "/orders" its
 * orders. Without PORTAL_URL it stays at /portal on the one address.
 */

/** The portal's own address, or null when it shares the staff one. */
export const portalUrl = () => process.env.PORTAL_URL?.trim().replace(/\/$/, "") || null;

/** Whether this request came in on the portal's own address. */
export async function onPortalHost() {
  const url = portalUrl();
  if (!url) return false;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host === new URL(url).host;
}

/** The prefix for portal links on this request: "" on its own address, "/portal" otherwise. */
export async function portalBase() {
  return (await onPortalHost()) ? "" : "/portal";
}

/** An absolute portal link for emails and redirects: portalLink("/orders"). */
export const portalLink = (path = "") => {
  const url = portalUrl();
  return url ? `${url}${path || "/"}` : `${appUrl()}/portal${path}`;
};

/** An absolute link on the buyer's address for pages outside the portal (invite, reset). */
export const buyerSiteLink = (path: string) => `${portalUrl() ?? appUrl()}${path}`;
