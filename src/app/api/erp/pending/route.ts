import { prisma } from "@/lib/db";
import { canSee, requestDivisionsOf } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * What's waiting for staff: paid egg orders to fulfil, feed requests and
 * buyers' receipts to check. Polled by the ERP each minute — counts only.
 */
export async function GET() {
  let grants;
  try {
    grants = await grantsOf((await requireStaff()).user.id);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: "signed out" }, { status: 401 });
    throw e;
  }
  const [orders, requests, receipts] = await Promise.all([
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
    // Buyers' receipts waiting to be checked.
    canSee(grants, "eggsales") || canSee(grants, "money")
      ? prisma.paymentProof.count({ where: { status: "submitted" } })
      : Promise.resolve(0),
  ]);
  return Response.json(
    { orders, requests, receipts },
    { headers: { "Cache-Control": "no-store" } }
  );
}
