import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";

/** The current session, read once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export class AuthError extends Error {}

/** Every ERP read and write goes through this. */
export async function requireStaff() {
  const session = await getSession();
  if (!session || session.user.role !== "staff") {
    throw new AuthError("Staff sign-in required.");
  }
  return session;
}

/** Portal writes: a customer login linked to a buyer record. */
export async function requireCustomer() {
  const session = await getSession();
  const customerId = session?.user.customerId;
  if (!session || session.user.role !== "customer" || !customerId) {
    throw new AuthError("Buyer sign-in required.");
  }
  return { session, customerId };
}
