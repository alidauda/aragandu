import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { settleCharge } from "@/lib/paystack";

/**
 * Where Paystack sends the buyer after checkout. We verify the reference
 * with Paystack ourselves before recording anything, then show the portal.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  let result = "unknown";
  if (reference) {
    try {
      result = await settleCharge(reference);
    } catch (e) {
      // The webhook will still record it; tell the buyer it's being confirmed.
      console.error(e);
      result = "pending";
    }
  }
  // Order payments go back to Orders; invoice payments to Payments.
  const charge = reference
    ? await prisma.paystackCharge.findUnique({ where: { reference }, select: { orderId: true } })
    : null;
  const page = charge?.orderId ? "orders" : "payments";
  return Response.redirect(`${appUrl()}/portal/${page}?payment=${result}`, 303);
}
