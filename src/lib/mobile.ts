import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { auth } from "@/lib/auth";
import { isTeam } from "@/lib/roles";

/**
 * The phone app (mobile/) talks to the endpoints under /api/mobile. It signs
 * in for a token and sends it with each request; everything it reads and
 * writes goes through the same role checks as the website.
 */

/** Set while a write runs for the phone app, where there's no page to reload. */
export const fromPhone = new AsyncLocalStorage<boolean>();

/** The token a request carries ("" when there's none). A browser's cookie is never used here. */
const tokenOf = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  return header.slice(0, 7).toLowerCase() === "bearer " ? header.slice(7).trim() : "";
};

/** The signed-in staff member behind a phone request, or null. */
export async function phoneStaff(request: Request) {
  const token = tokenOf(request);
  if (!token) return null;
  const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
  if (!session || !isTeam(session.user.role) || session.user.disabled) return null;
  return session;
}

/**
 * The app's browser build, used to test it on a computer, runs on another
 * address and needs these. Phones don't, so the live site sends none.
 */
export function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" || !origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

/** A JSON answer for the phone: never cached. */
export const reply = (request: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...cors(request) } });

/** The browser's check before a cross-address request. */
export const preflight = (request: Request) => new Response(null, { status: 204, headers: cors(request) });

export const SIGNED_OUT = { ok: false, error: "Sign in again to continue.", signedOut: true } as const;
