import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { buyerSiteLink } from "@/lib/portal-host";

/** How long a reset link works. */
export const RESET_MINUTES = 60;

/**
 * A one-time link to choose a new password — the same token Better Auth's
 * reset uses, so /reset-password accepts it. A buyer's opens on the
 * portal's own address.
 */
export async function createResetLink(user: { id: string; role: string }) {
  const token = randomBytes(18).toString("base64url");
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier: `reset-password:${token}`,
      value: user.id,
      expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
    },
  });
  return user.role === "customer"
    ? buyerSiteLink(`/reset-password?token=${token}&for=portal`)
    : `${appUrl()}/reset-password?token=${token}`;
}

/** Whether a reset link was made for them in the last minute (one request a minute). */
export async function resetAskedJustNow(userId: string) {
  const recent = await prisma.verification.findFirst({
    where: {
      value: userId,
      identifier: { startsWith: "reset-password:" },
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
    select: { id: true },
  });
  return recent !== null;
}
