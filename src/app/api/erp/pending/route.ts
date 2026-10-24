import { prisma } from "@/lib/db";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * What's waiting for staff: paid egg orders to fulfil and feed requests. Polled
 * by the ERP each minute — two counts, so it stays cheap.
 */
export async function GET() {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: "signed out" }, { status: 401 });
    throw e;
  }
  const [orders, requests] = await Promise.all([
    // Paid orders only: unpaid ones aren't the farm's to fulfil yet.
    prisma.eggOrder.count({ where: { status: "pending", paidAt: { not: null } } }),
    prisma.feedRequest.count({ where: { status: "pending" } }),
  ]);
  return Response.json(
    { orders, requests },
    { headers: { "Cache-Control": "no-store" } }
  );
}
