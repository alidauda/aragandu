import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { buyerSiteLink } from "@/lib/portal-host";
import { mailPasswordChanged, mailPasswordReset } from "@/lib/mail";

/** Best-effort: an email failure never fails the sign-in flow. */
const quietly = (p: Promise<unknown>) => void p.catch((e) => console.error("auth email failed", e));

/**
 * Email + password for both staff (ERP) and buyers (portal). There is no
 * public sign-up: staff accounts come from `npm run user:create`, buyer
 * logins are issued by staff from the Customers page.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // The staff address (BETTER_AUTH_URL) is trusted already; the buyer portal
  // may have its own. Each address keeps its own sign-in cookie.
  trustedOrigins: process.env.PORTAL_URL ? [new URL(process.env.PORTAL_URL).origin] : [],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    // "Forgot password?" emails a one-time link to /reset-password.
    sendResetPassword: async ({ user, token }) => {
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { disabled: true, role: true } });
      if (!u || u.disabled) return; // access removed: no way back in by email
      const forPortal = u.role === "customer" ? "&for=portal" : "";
      // Not awaited, so the response time doesn't reveal whether the email exists.
      // (The sign-in pages use requestPasswordReset in app/forgot-password, which
      // reports a failed send; this is Better Auth's own endpoint.)
      quietly(
        mailPasswordReset({
          email: user.email,
          name: user.name,
          // A buyer resets on the portal's own address.
          url: `${forPortal ? buyerSiteLink("") : appUrl()}/reset-password?token=${encodeURIComponent(token)}${forPortal}`,
        })
      );
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => quietly(mailPasswordChanged(user)),
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
      customerId: { type: "number", required: false, input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
      owner: { type: "boolean", defaultValue: false, input: false },
      division: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // A disabled account can't start a session, whatever the password.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { disabled: true },
          });
          if (user?.disabled) {
            throw new APIError("FORBIDDEN", { message: "This account has been disabled." });
          }
        },
      },
    },
  },
  hooks: {
    // A changed password gets a heads-up email, in case it wasn't them.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/change-password" || ctx.context.returned instanceof Error) return;
      const user = ctx.context.session?.user;
      if (user) quietly(mailPasswordChanged(user));
    }),
  },
  advanced: {
    ipAddress: {
      // Railway's edge appends the real client IP to X-Forwarded-For (and
      // keeps whatever the client sent before it). Treat Railway's internal
      // hops as trusted so the rightmost outside address is used; otherwise
      // every visitor shares one sign-in rate-limit bucket.
      ipAddressHeaders: ["x-forwarded-for"],
      trustedProxies: ["100.64.0.0/10", "10.0.0.0/8"],
    },
  },
  // Must stay last: it forwards Set-Cookie from server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
