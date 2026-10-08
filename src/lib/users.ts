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
  }
) {
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new Error(`A login for ${email} already exists.`);
  }
  const id = randomUUID();
  const password = await hashPassword(input.password);
  return db.user.create({
    data: {
      id,
      name: input.name.trim(),
      email,
      role: input.role,
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
