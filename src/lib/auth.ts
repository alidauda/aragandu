import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";

/**
 * Email + password for both staff (ERP) and buyers (portal). There is no
 * public sign-up: staff accounts come from `npm run user:create`, buyer
 * logins are issued by staff from the Customers page.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
      customerId: { type: "number", required: false, input: false },
    },
  },
  // Must stay last: it forwards Set-Cookie from server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
