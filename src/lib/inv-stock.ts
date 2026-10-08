import "server-only";

import { RuleError, type Tx } from "@/lib/egg-orders";

/**
 * Central-store guard. An item's stock at a location is everything moved
 * in minus everything moved out; a move or a health record can't take more
 * than the location holds. Locked like the other stock guards.
 */

const INV_STOCK_LOCK = 4244;

export async function takeFromLocation(tx: Tx, itemId: number, location: string, qty: number) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${INV_STOCK_LOCK})::text`;
  const [item, inbound, outbound] = await Promise.all([
    tx.invItem.findUnique({ where: { id: itemId }, select: { name: true, unit: true } }),
    tx.invMove.aggregate({ where: { itemId, toLoc: location }, _sum: { qty: true } }),
    tx.invMove.aggregate({ where: { itemId, fromLoc: location }, _sum: { qty: true } }),
  ]);
  if (!item) throw new RuleError("That item no longer exists.");
  const here = (inbound._sum.qty ?? 0) - (outbound._sum.qty ?? 0);
  if (qty > here + 1e-9) {
    const where = location === "store" ? "the store" : location[0].toUpperCase() + location.slice(1);
    throw new RuleError(
      here <= 0
        ? `No ${item.name} at ${where}.${location === "store" ? " Record a receipt first." : " Move some there from the store first."}`
        : `Only ${here.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${item.unit} of ${item.name} at ${where}.`
    );
  }
}
