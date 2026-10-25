import { prisma } from "@/lib/db";
import { canSee, requestDivisionsOf } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * What's waiting for staff: paid egg orders to fulfil and feed requests. Polled
 * by the ERP each minute — two counts, so it stays cheap.
 */
export async function GET() {
  let grants;
  try {
    grants = await grantsOf((await requireStaff()).user.id);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: "signed out" }, { status: 401 });
    throw e;
  }
  const [orders, requests] = await Promise.all([
    // Paid orders only: unpaid ones aren't the farm's to fulfil yet. Each
    // division counts only what it can see.
    canSee(grants, "eggsales")
      ? prisma.eggOrder.count({ where: { status: "pending", paidAt: { not: null } } })
      : Promise.resolve(0),
    (() => {
      const asks = requestDivisionsOf(grants);
      if (!canSee(grants, "requests")) return Promise.resolve(0);
      return prisma.feedRequest.count({ where: { status: "pending", ...(asks ? { division: { in: asks } } : {}) } });
    })(),
  ]);
  return Response.json(
    { orders, requests },
    { headers: { "Cache-Control": "no-store" } }
  );
}
