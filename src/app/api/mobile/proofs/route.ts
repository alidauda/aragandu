import { POST as upload } from "@/app/api/erp/proofs/route";
import { cors, phoneStaff, preflight, reply, SIGNED_OUT } from "@/lib/mobile";

/** A buyer's receipt photographed in the app: the website's own upload, by token. */
export async function POST(request: Request) {
  if (!(await phoneStaff(request))) return reply(request, SIGNED_OUT, 401);
  const res = await upload(request);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors(request))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export const OPTIONS = preflight;
