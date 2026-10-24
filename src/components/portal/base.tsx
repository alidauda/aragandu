"use client";

import { createContext, useContext } from "react";

/**
 * The prefix for portal links on this address: "" when the portal has its
 * own (customer.…), "/portal" when it shares the staff one.
 */
const PortalBase = createContext("/portal");

export function PortalBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <PortalBase.Provider value={base}>{children}</PortalBase.Provider>;
}

/** p("/orders") → "/orders" or "/portal/orders"; p("") → the portal home. */
export function usePortalPath() {
  const base = useContext(PortalBase);
  return (path = "") => `${base}${path}` || "/";
}
