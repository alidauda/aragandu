import { canAct } from "@/lib/access";
import { saleAreaOf } from "@/lib/erp/broilers";
import { grantsOf } from "@/lib/grants";
import { submitProof } from "@/lib/proofs";
import { AuthError, requireStaff } from "@/lib/session";

/**
 * Staff upload a buyer's payment receipt for them (the buyer sent it on
 * WhatsApp, paid at the counter…). Whoever sells that product can, for any
 * buyer, registered or walk-in; so can admins of egg sales or money. Each
 * receipt keeps the uploader's name, and the upload goes in the Activity log.
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

  const r = await submitProof(
    await request.formData().catch(() => null),
    { userId: session.user.id, name: session.user.name },
    (product) => admin || canAct(g, saleAreaOf(product), "staff") || "That isn't part of your work."
  );
  return Response.json(r.ok ? r : { ok: false, error: r.error }, { status: r.ok ? 200 : (r.status ?? 400) });
}
