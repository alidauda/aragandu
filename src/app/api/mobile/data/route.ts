import { loadErpData } from "@/lib/erp/queries";
import { grantsOf } from "@/lib/grants";
import { phoneStaff, preflight, reply, SIGNED_OUT } from "@/lib/mobile";

/**
 * Everything the signed-in staff member may see, cut to their roles exactly
 * as the website's pages are. The app keeps a copy to work from when there's
 * no signal.
 */
export async function GET(request: Request) {
  const session = await phoneStaff(request);
  if (!session) return reply(request, SIGNED_OUT, 401);
  const grants = await grantsOf(session.user.id);
  const data = await loadErpData({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role === "admin" ? "admin" : "staff",
    owner: grants.owner,
    grants,
  });
  return reply(request, { ok: true, data });
}

export const OPTIONS = preflight;
