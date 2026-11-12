import { auth } from "@/lib/auth";
import { preflight, reply } from "@/lib/mobile";

/** Ends the phone's session, so its token stops working. */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) await auth.api.signOut({ headers: new Headers({ authorization }) }).catch(() => null);
  return reply(request, { ok: true });
}

export const OPTIONS = preflight;
