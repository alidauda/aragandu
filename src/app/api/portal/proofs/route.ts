import { submitProof } from "@/lib/proofs";
import { AuthError, requireCustomer } from "@/lib/session";

/**
 * A buyer uploads proof of a payment made outside the app — a transfer
 * receipt or bank slip (JPEG, PNG, WebP or PDF, up to 5 MB) — against one
 * of their own unpaid orders or invoices.
 */
export async function POST(request: Request) {
  let buyer;
  try {
    buyer = await requireCustomer();
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ ok: false, error: e.message }, { status: 401 });
    throw e;
  }
  const r = await submitProof(await request.formData().catch(() => null), {
    userId: buyer.session.user.id,
    name: buyer.session.user.name,
    customerId: buyer.customerId,
  });
  return Response.json(r.ok ? r : { ok: false, error: r.error }, { status: r.ok ? 200 : (r.status ?? 400) });
}
