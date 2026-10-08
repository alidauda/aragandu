import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { RuleError } from "@/lib/egg-orders";
import { createCredentialUser } from "@/lib/users";

/**
 * Invite links: staff create one, copy it, and send it however they like.
 * Opening it lets the person choose their own password. The token is only
 * ever in the link — the database keeps its hash — and it works once.
 */

const INVITE_DAYS = 7;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createInvite(input: {
  email: string;
  name: string;
  role: "staff" | "customer";
  customerId?: number;
  createdById: string;
}): Promise<{ path: string }> {
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new RuleError(`${email} already has a login.`);
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // A fresh invite replaces any earlier link for the same email.
    prisma.invite.updateMany({
      where: { email, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.invite.create({
      data: {
        tokenHash: hashToken(token),
        email,
        name: input.name.trim(),
        role: input.role,
        customerId: input.customerId ?? null,
        createdById: input.createdById,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return { path: `/invite/${token}` };
}

/** The invite behind a link, if it can still be used. */
export async function findOpenInvite(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: { select: { name: true } } },
  });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt < new Date()) {
    return null;
  }
  return invite;
}

/** Spends the invite and creates the login, atomically. */
export async function acceptInvite(token: string, password: string) {
  return prisma.$transaction(async (tx) => {
    const spent = await tx.invite.updateMany({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (spent.count === 0) {
      throw new RuleError("This invite link has expired or was already used.");
    }
    const invite = await tx.invite.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    if (await tx.user.findUnique({ where: { email: invite.email } })) {
      throw new RuleError(`${invite.email} already has a login. Sign in instead.`);
    }
    await createCredentialUser(tx, {
      name: invite.name,
      email: invite.email,
      password,
      role: invite.role === "staff" ? "staff" : "customer",
      customerId: invite.customerId ?? undefined,
    });
    return { email: invite.email, role: invite.role };
  });
}
