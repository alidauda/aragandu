import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { saleAreaOf } from "@/lib/erp/broilers";
import { proofFile } from "@/lib/proofs";
import { getSession } from "@/lib/session";

/**
 * A payment proof's file, for the buyer who uploaded it and for staff who
 * see egg sales or money, or who sell what its invoice sold. Shown in the browser, never run: the type was
 * checked on upload and the browser is told not to guess.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/proofs/[id]">) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  const session = await getSession();
  if (!session || session.user.disabled) return new Response("Sign in first.", { status: 401 });
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found.", { status: 404 });

  const proof = await proofFile(id);
  if (!proof) return new Response("Not found.", { status: 404 });
  const role = session.user.role;
  const allowed =
    role === "customer"
      ? // A walk-in's receipt belongs to no buyer account.
        proof.customerId !== null && session.user.customerId === proof.customerId
      : await grantsOf(session.user.id).then(
          (g) =>
            canSee(g, "eggsales") ||
            canSee(g, "money") ||
            // Other divisions' sellers open the receipts on their own sales.
            (proof.invoice !== null && canSee(g, saleAreaOf(proof.invoice.product)))
        );
  if (!allowed) return new Response("Not found.", { status: 404 });

  return new Response(new Uint8Array(proof.data), {
    headers: {
      "Content-Type": proof.mimeType,
      "Content-Disposition": `inline; filename="${proof.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      // Images get a locked-down page; Chrome's PDF viewer won't run sandboxed.
      ...(proof.mimeType.startsWith("image/")
        ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }
        : {}),
      "Cache-Control": "private, max-age=300",
    },
  });
}
