import { settleCharge, validSignature } from "@/lib/paystack";

/**
 * Paystack's server-to-server notice. It records the payment even if the
 * buyer closed the tab before coming back. Set this URL in the Paystack
 * dashboard: Settings → API Keys & Webhooks → Webhook URL.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } };
  if (event.event === "charge.success" && event.data?.reference) {
    try {
      // Verifies with Paystack again before recording — the webhook body alone isn't trusted.
      await settleCharge(event.data.reference);
    } catch (e) {
      console.error(e);
      // A non-200 makes Paystack retry later.
      return new Response("Retry", { status: 500 });
    }
  }
  return new Response("OK");
}
