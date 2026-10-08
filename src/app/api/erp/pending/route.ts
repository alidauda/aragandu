import { prisma } from "@/lib/db";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * What's waiting for staff: pending egg orders and feed requests. Polled
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
    prisma.eggOrder.count({ where: { status: "pending" } }),
    prisma.feedRequest.count({ where: { status: "pending" } }),
  ]);
  return Response.json(
    { orders, requests },
    { headers: { "Cache-Control": "no-store" } }
  );
}
