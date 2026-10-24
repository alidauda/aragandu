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
  return Response.redirect(`${appUrl()}/portal?payment=${result}`, 303);
}
