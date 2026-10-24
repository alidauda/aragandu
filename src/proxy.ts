import { NextResponse, type NextRequest } from "next/server";

/**
 * Two addresses, one app. When PORTAL_URL is set (e.g.
 * https://customer.argandufarms.com.ng), requests on that address are the
 * buyer portal: "/" → /portal, "/orders" → /portal/orders, and staff pages
 * don't exist there. On the staff address, /portal links move to the
 * buyer's address. Pages still check who's signed in themselves.
 */

/** Pages and endpoints both addresses serve as they are. */
const SHARED = ["/api", "/invite", "/forgot-password", "/reset-password"];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function proxy(request: NextRequest) {
  const portal = process.env.PORTAL_URL?.trim().replace(/\/$/, "");
  if (!portal) return NextResponse.next();

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const { pathname, search } = request.nextUrl;

  if (host === new URL(portal).host) {
    if (SHARED.some((p) => under(pathname, p))) return NextResponse.next();
    // Old /portal links and the staff sign-in land on the portal's own paths.
    if (under(pathname, "/portal")) return NextResponse.redirect(`${portal}${pathname.slice(7) || "/"}${search}`, 308);
    if (under(pathname, "/login")) return NextResponse.redirect(`${portal}/${search}`, 307);
    const to = request.nextUrl.clone();
    to.pathname = `/portal${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(to);
  }

  // The staff address sends buyers to theirs.
  if (under(pathname, "/portal")) {
    return NextResponse.redirect(`${portal}${pathname.slice(7) || "/"}${search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Everything but build assets and the self-hosted fonts.
  matcher: ["/((?!_next/static|_next/image|fonts/|icon.svg|favicon.ico).*)"],
};
