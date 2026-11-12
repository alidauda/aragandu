import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import * as actions from "@/lib/erp/actions";
import type { ActionResult } from "@/lib/erp/actions";
import { fromPhone, phoneStaff, preflight, reply, SIGNED_OUT } from "@/lib/mobile";

/**
 * The entries the phone app can make. Each is the website's own action, so
 * the same roles, rules and Activity log apply.
 */
const ACTIONS = {
  addDailyRecords: actions.addDailyRecords,
  addBroilerDaily: actions.addBroilerDaily,
  addEggMove: actions.addEggMove,
  addInvoice: actions.addInvoice,
} as const;

const input = z.object({
  /** Made on the phone, once per entry: sending the entry again saves nothing new. */
  key: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  name: z.string(),
  input: z.unknown(),
});

/** An entry that started saving and never finished is left alone this long. */
const STUCK_MS = 60_000;

export async function POST(request: Request) {
  const session = await phoneStaff(request);
  if (!session) return reply(request, SIGNED_OUT, 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply(request, { ok: false, error: "That entry couldn't be read." }, 400);
  const { key, name } = parsed.data;
  const action = (ACTIONS as Record<string, (raw: never) => Promise<ActionResult<unknown>>>)[name];
  if (!action || !Object.hasOwn(ACTIONS, name)) return reply(request, { ok: false, error: "The app can't make that entry yet." }, 400);

  // Claim the key. If it's taken, this entry has been here before.
  try {
    await prisma.mobileWrite.create({ data: { id: key, userId: session.user.id, action: name } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const seen = await prisma.mobileWrite.findUnique({ where: { id: key } });
    if (seen && seen.userId !== session.user.id) return reply(request, { ok: false, error: "That entry couldn't be read." }, 400);
    if (seen?.result) return reply(request, seen.result);
    if (seen && Date.now() - seen.createdAt.getTime() < STUCK_MS) {
      return reply(request, { ok: false, error: "Still saving — try again in a moment.", retry: true }, 409);
    }
    // It started and never finished: it may or may not have been saved.
    return reply(request, { ok: false, error: "We couldn't confirm this was saved. Check the records before entering it again.", unsure: true }, 409);
  }

  let result: ActionResult<unknown>;
  try {
    result = await fromPhone.run(true, () => action(parsed.data.input as never));
  } catch (e) {
    await prisma.mobileWrite.delete({ where: { id: key } }).catch(() => null);
    throw e;
  }
  if (result.ok) {
    await prisma.mobileWrite.update({ where: { id: key }, data: { result: { ok: true } } });
    return reply(request, { ok: true });
  }
  // Refused: nothing was saved, so the same entry may be sent again (after signing in, say).
  await prisma.mobileWrite.delete({ where: { id: key } }).catch(() => null);
  return reply(request, result, result.signedOut ? 401 : 422);
}

export const OPTIONS = preflight;
