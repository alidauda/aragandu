import { canAct } from "@/lib/access";
import { saleAreaOf } from "@/lib/erp/broilers";
import { grantsOf } from "@/lib/grants";
import { submitProof } from "@/lib/proofs";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * Staff upload a buyer's payment receipt for them (the buyer sent it on
 * WhatsApp, paid at the counter…). Admins of egg sales or money always can.
 * Whoever sells that product can for a walk-in buyer, and for a registered
 * buyer an admin has allowed (Customers → Edit).
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ ok: false, error: e.message }, { status: 401 });
    throw e;
  }
  const g = await grantsOf(session.user.id);
  const admin = canAct(g, "eggsales", "admin") || canAct(g, "money", "admin");
  const sells = (product: string) => canAct(g, saleAreaOf(product), "staff");

  const r = await submitProof(
    await request.formData().catch(() => null),
    { userId: session.user.id, name: session.user.name },
    (customer, product) => {
      if (admin) return true;
      if (!sells(product)) return "That isn't part of your work.";
      // A walk-in has no account to upload from, so the seller does it.
      if (customer === null) return true;
      return (
        customer.staffReceipts ||
        "Only an admin can upload receipts for this buyer — an admin can allow sales staff on Customers → Edit."
      );
    }
  );
  return Response.json(r.ok ? r : { ok: false, error: r.error }, { status: r.ok ? 200 : (r.status ?? 400) });
}
