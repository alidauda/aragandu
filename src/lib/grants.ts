import "server-only";

import { asGrants, type Grants, NO_GRANTS } from "@/lib/access";
import { prisma } from "@/lib/db";

/**
 * A team member's roles, read fresh from the database so a change (or a
 * removed role) takes effect at once, not at their next sign-in.
 */
export async function grantsOf(userId: string): Promise<Grants> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, owner: true, access: true, division: true, disabled: true },
  });
  if (!u || u.disabled || (u.role !== "admin" && u.role !== "staff")) return NO_GRANTS;
  if (u.access) return asGrants(u.access, u.owner);
  // Logins from before multi-role access: one role, farm-wide or one division.
  return asGrants(
    u.division ? { divisions: { [u.division]: u.role } } : { farm: u.role },
    u.owner
  );
}
