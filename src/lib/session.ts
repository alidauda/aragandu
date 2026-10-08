import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { isTeam } from "@/lib/roles";

/** The current session, read once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export class AuthError extends Error {}

/** Every ERP read and write goes through this (admins included). */
export async function requireStaff() {
  const session = await getSession();
  if (!session || !isTeam(session.user.role) || session.user.disabled) {
    throw new AuthError("Staff sign-in required.");
  }
  return session;
}

/** Money, settings, corrections and people. */
export class ForbiddenError extends Error {}
export async function requireAdmin() {
  const session = await requireStaff();
  if (session.user.role !== "admin") {
    throw new ForbiddenError("Only an admin can do that.");
  }
  return session;
}

/** Portal writes: a customer login linked to a buyer record. */
export async function requireCustomer() {
  const session = await getSession();
  const customerId = session?.user.customerId;
  if (!session || session.user.role !== "customer" || !customerId || session.user.disabled) {
    throw new AuthError("Buyer sign-in required.");
  }
  return { session, customerId };
}
