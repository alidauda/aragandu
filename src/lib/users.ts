import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/lib/roles";

type Db = Pick<PrismaClient, "user">;

/**
 * Creates an email/password login the way Better Auth's own sign-up would:
 * a user row plus a "credential" account holding the password hash. Sign-up
 * is disabled over HTTP, so this is the only way logins come into being.
 * Takes the client as an argument so CLI scripts can call it too.
 */
export async function createCredentialUser(
  db: Db,
  input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    customerId?: number;
    /** Legacy: one division (null = the whole farm). Prefer `access`. */
    division?: string | null;
    /** The team member's roles (see src/lib/access.ts). */
    access?: unknown;
  }
) {
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new Error(`A login for ${email} already exists.`);
  }
  const id = randomUUID();
  const password = await hashPassword(input.password);
  // The first admin there ever is becomes the farm owner (always farm-wide).
  const team = input.role === "admin" || input.role === "staff";
  // Without explicit roles: farm-wide, or one division, at their level.
  const access = !team
    ? undefined
    : (input.access ??
      (input.division ? { divisions: { [input.division]: input.role } } : { farm: input.role, divisions: {}, functions: [] }));
  const farmAdmin = (access as { farm?: string } | undefined)?.farm === "admin";
  const owner = input.role === "admin" && farmAdmin && !(await db.user.findFirst({ where: { owner: true } }));
  return db.user.create({
    data: {
      id,
      name: input.name.trim(),
      email,
      role: input.role,
      owner,
      division: null,
      access: access as object | undefined,
      customerId: input.customerId ?? null,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password,
        },
      },
    },
  });
}
