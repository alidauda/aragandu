import "server-only";

import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { farmToday } from "@/lib/dates";
import { loadErpData } from "@/lib/erp/queries";
import { paymentLedger } from "@/lib/payment-ledger";
import { readPeriod } from "@/lib/period";
import { buildFarmReport } from "@/lib/reports/farm-report";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";

/**
 * The signed-in team member's report for the period in the URL — cut to
 * their division like everything else. Null when they may not see reports.
 */
export async function loadFarmReport(params: Record<string, string | string[] | undefined>) {
  const session = await getSession();
  if (!session || !isTeam(session.user.role) || session.user.disabled) return null;
  const grants = await grantsOf(session.user.id);
  if (!canSee(grants, "reports")) return null;
  const isAdmin = session.user.role === "admin";

  const today = farmToday();
  const period = readPeriod(params, today);
  const [data, ledger] = await Promise.all([
    loadErpData({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: isAdmin ? "admin" : "staff",
      owner: grants.owner,
      grants,
    }),
    canSee(grants, "money") ? paymentLedger(period.from, period.to).then((l) => l.entries) : null,
  ]);
  const report = buildFarmReport({
    data,
    ledger,
    from: period.from,
    to: period.to,
    grants,
    generatedBy: session.user.name,
    generatedAt: new Date().toLocaleString("en-GB", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  return { report, period, today };
}
