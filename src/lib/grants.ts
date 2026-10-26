import "server-only";

import { asGrants, type Grants, NO_GRANTS } from "@/lib/access";
import { prisma } from "@/lib/db";

type Row = { role: string; owner: boolean; access: unknown; division: string | null; disabled: boolean };
const select = { role: true, owner: true, access: true, division: true, disabled: true } as const;

/** The roles on a team login, whether or not its access is on. */
function rolesOf(u: Row): Grants {
  if (u.role !== "admin" && u.role !== "staff") return NO_GRANTS;
  if (u.access) return asGrants(u.access, u.owner);
  // Logins from before multi-role access: one role, farm-wide or one division.
  return asGrants(u.division ? { divisions: { [u.division]: u.role } } : { farm: u.role }, u.owner);
}

/**
 * A team member's roles, read fresh from the database so a change (or a
 * removed role) takes effect at once, not at their next sign-in. A disabled
 * login has none.
 */
export async function grantsOf(userId: string): Promise<Grants> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select });
  if (!u || u.disabled) return NO_GRANTS;
  return rolesOf(u);
}

/**
 * The roles someone holds even while their access is off — for deciding
 * who may manage them (a disabled admin is still an admin to restore).
 */
export async function heldGrants(userId: string): Promise<Grants> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select });
  return u ? rolesOf(u) : NO_GRANTS;
}
