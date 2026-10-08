import "server-only";

import { RuleError, type Tx } from "@/lib/egg-orders";

/**
 * Feed-mill stock guards, derived the same way the screens derive them:
 * ingredients = deliveries − kg charged into runs; finished feed = run
 * output − bags sold × bag size. Each takes a transaction-scoped lock so
 * two writes can't both spend the same stock.
 */

// Shared by every write that draws on mill stock.
const FEED_STOCK_LOCK = 4243;

const lock = (tx: Tx) => tx.$queryRaw`SELECT pg_advisory_xact_lock(${FEED_STOCK_LOCK})::text`;

const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** Every line of a run must fit within that ingredient's stock. */
export async function takeIngredients(tx: Tx, lines: [ingredientId: number, kg: number][]) {
  await lock(tx);
  // One run can list the same ingredient twice; check the total.
  const want = new Map<number, number>();
  for (const [ing, n] of lines) want.set(ing, (want.get(ing) ?? 0) + n);

  const ids = [...want.keys()];
  const [ingredients, delivered, used] = await Promise.all([
    tx.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    tx.ingredientDelivery.groupBy({
      by: ["ingredientId"],
      where: { ingredientId: { in: ids } },
      _sum: { kg: true },
    }),
    tx.runLine.groupBy({
      by: ["ingredientId"],
      where: { ingredientId: { in: ids } },
      _sum: { kg: true },
    }),
  ]);
  for (const [ing, n] of want) {
    const name = ingredients.find((i) => i.id === ing)?.name;
    if (!name) throw new RuleError("One of the ingredients no longer exists.");
    const onHand =
      (delivered.find((d) => d.ingredientId === ing)?._sum.kg ?? 0) -
      (used.find((u) => u.ingredientId === ing)?._sum.kg ?? 0);
    if (n > onHand + 1e-9) {
      throw new RuleError(
        onHand <= 0
          ? `No ${name} in stock. Record a delivery first.`
          : `Only ${kg(onHand)} kg of ${name} in stock.`
      );
    }
  }
}

/** Bags of finished feed must exist before they're sold or issued. */
export async function takeBags(tx: Tx, productId: number, bags: number) {
  await lock(tx);
  const [product, produced, sold] = await Promise.all([
    tx.feedProduct.findUnique({ where: { id: productId } }),
    tx.productionRun.aggregate({ where: { productId }, _sum: { outputKg: true } }),
    tx.feedSale.aggregate({ where: { productId }, _sum: { bags: true } }),
  ]);
  if (!product) throw new RuleError("That product no longer exists.");
  const onHandKg = (produced._sum.outputKg ?? 0) - (sold._sum.bags ?? 0) * product.bagKg;
  const available = Math.floor(onHandKg / product.bagKg + 1e-9);
  if (bags > available) {
    throw new RuleError(
      available <= 0
        ? `No ${product.name} in stock. Record a production run first.`
        : `Only ${available} bags of ${product.name} in stock.`
    );
  }
}

/** Taking `kgOut` out of finished stock (deleting a run) must leave it ≥ 0. */
export async function takeFinishedKg(tx: Tx, productId: number, kgOut: number) {
  await lock(tx);
  const [product, produced, sold] = await Promise.all([
    tx.feedProduct.findUnique({ where: { id: productId } }),
    tx.productionRun.aggregate({ where: { productId }, _sum: { outputKg: true } }),
    tx.feedSale.aggregate({ where: { productId }, _sum: { bags: true } }),
  ]);
  if (!product) throw new RuleError("That product no longer exists.");
  const onHandKg = (produced._sum.outputKg ?? 0) - (sold._sum.bags ?? 0) * product.bagKg;
  if (kgOut > onHandKg + 1e-9) {
    throw new RuleError(
      `Some of this run's ${product.name} has already been sold or issued — delete those sales first.`
    );
  }
}
