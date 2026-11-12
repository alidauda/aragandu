import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { preflight, reply } from "@/lib/mobile";
import { isTeam } from "@/lib/roles";

const input = z.object({ email: z.string().trim().toLowerCase().min(3).max(200), password: z.string().min(1).max(200) });

/**
 * The phone app's sign-in: the same email and password as the website. It
 * answers with a token the app keeps and sends with every request. Staff
 * only — buyers use the website.
 */
export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply(request, { ok: false, error: "Enter your email and password." }, 400);

  // Through Better Auth's own endpoint, so its sign-in limits apply here too.
  const headers = new Headers({ "content-type": "application/json" });
  for (const h of ["x-forwarded-for", "user-agent"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const res = await auth.handler(
    new Request(new URL("/api/auth/sign-in/email", request.url), { method: "POST", headers, body: JSON.stringify(parsed.data) })
  );
  const body = (await res.json().catch(() => null)) as { token?: string; user?: { id: string }; message?: string } | null;
  if (!res.ok || !body?.token || !body.user) {
    if (res.status === 429) return reply(request, { ok: false, error: "Too many tries. Wait a minute, then try again." }, 429);
    if (res.status === 403) return reply(request, { ok: false, error: body?.message ?? "This account can't sign in." }, 403);
    return reply(request, { ok: false, error: "Wrong email or password." }, 401);
  }

  const user = await prisma.user.findUnique({ where: { id: body.user.id }, select: { name: true, email: true, role: true } });
  if (!user || !isTeam(user.role)) {
    await prisma.session.deleteMany({ where: { token: body.token } });
    return reply(request, { ok: false, error: "This app is for farm staff. Buyers order on the website." }, 403);
  }
  return reply(request, { ok: true, token: res.headers.get("set-auth-token") ?? body.token, user: { id: body.user.id, name: user.name, email: user.email } });
}

export const OPTIONS = preflight;
