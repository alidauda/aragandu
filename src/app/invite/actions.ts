"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { RuleError } from "@/lib/egg-orders";
import { acceptInvite } from "@/lib/invites";
import { isTeam } from "@/lib/roles";

const input = z
  .object({
    token: z.string().min(20).max(100),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, "The two passwords don't match.");

/** Spends the invite, creates the login, signs them in, and sends them home. */
export async function acceptInviteAction(raw: z.input<typeof input>) {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { token, password } = parsed.data;

  let created: { email: string; role: string };
  try {
    created = await acceptInvite(token, password);
  } catch (e) {
    if (e instanceof RuleError) return { ok: false as const, error: e.message };
    console.error(e);
    return { ok: false as const, error: "Couldn't set up your account. Please try again." };
  }

  const team = isTeam(created.role);
  const home = team ? "/" : "/portal";
  try {
    // nextCookies() turns this into a Set-Cookie on the action's response.
    await auth.api.signInEmail({
      body: { email: created.email, password },
      headers: await headers(),
    });
  } catch (e) {
    // The account exists and the link is spent; send them to sign in.
    console.error(e);
    redirect(team ? "/login?created=1" : "/portal?created=1");
  }
  redirect(home);
}
