/**
 * Who can do what.
 * - admin: everything, including money, settings, corrections and people.
 * - staff: day-to-day records in the ERP.
 * - customer: the buyer portal only.
 */
export type Role = "admin" | "staff" | "customer";
export type TeamRole = Exclude<Role, "customer">;

/** Signs in to the ERP. */
export const isTeam = (role: string | null | undefined): role is TeamRole =>
  role === "admin" || role === "staff";

export const asRole = (role: string): Role => (isTeam(role) ? role : "customer");

export const roleLabel = (role: Role) =>
  role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Buyer";
