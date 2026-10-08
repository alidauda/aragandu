/**
 * Pure derivations — the "nothing is stored" figures, computed from the
 * ledgers the layout loads from Postgres. Every function takes its ledgers
 * explicitly, so any one of them can later move into a SQL view unchanged.
 */

import type {
  Batch,
  Customer,
  Delivery,
  EggMove,
  EggOrder,
  FeedSale,
  FeedUse,
  House,
  Ingredient,
  InvItem,
  InvMove,
  Invoice,
  LayersFeedDelivery,
  ProdEntry,
  Product,
  Run,
} from "./types";

export const fmtN = (n: number) => "₦" + Math.round(n).toLocaleString("en-US");
export const fmtK = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const fmtD = (d: string) =>
  d.slice(8, 10) +
  " " +
  ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    +d.slice(5, 7)
  ];

export type BadgeTone = { bg: string; fg: string };
export function stBadge(s: string): BadgeTone {
  if (s === "paid" || s === "fulfilled" || s === "in-stock" || s === "active")
    return { bg: "#e8f2e5", fg: "#3f6f3a" };
  if (s === "pending" || s === "low") return { bg: "#fdf3e0", fg: "#a06a0e" };
  return { bg: "#fbe9e5", fg: "#b3402f" };
}

/** v_feed_ingredient_stock — deliveries add, run lines consume. */
export function ingredientPositions(
  ingredients: Ingredient[],
  deliveries: Delivery[],
  runs: Run[]
) {
  return ingredients.map((ing) => {
    const del = deliveries.filter((d) => d.ing === ing.id);
    const recv = del.reduce((a, d) => a + d.kg, 0);
    const spend = del.reduce((a, d) => a + d.kg * d.price, 0);
    let used = 0;
    runs.forEach((r) =>
      r.lines.forEach((l) => {
        if (l[0] === ing.id) used += l[1];
      })
    );
    const onHand = recv - used;
    const st = onHand <= 0 ? "out" : onHand < ing.reorder ? "low" : "in-stock";
    return { ...ing, recv, used, onHand, avg: recv ? spend / recv : 0, st };
  });
}

/** v_run_costing — charged, material cost, yield, from each run's own lines. */
export function runPositions(runs: Run[], products: Product[]) {
  return runs.map((r) => {
    const charged = r.lines.reduce((a, l) => a + l[1], 0);
    const cost = r.lines.reduce((a, l) => a + l[1] * l[2], 0);
    return {
      ...r,
      charged,
      cost,
      yieldPct: charged ? (100 * r.output) / charged : 0,
      pname: products.find((p) => p.id === r.product)?.name ?? "—",
    };
  });
}

/** v_feed_finished_stock — runs add, sales subtract in the product's bag size. */
export function finishedPositions(
  products: Product[],
  runs: Run[],
  feedSales: FeedSale[]
) {
  return products.map((p) => {
    const produced = runs
      .filter((r) => r.product === p.id)
      .reduce((a, r) => a + r.output, 0);
    const soldBags = feedSales
      .filter((s) => s.product === p.id)
      .reduce((a, s) => a + s.bags, 0);
    const onHandKg = produced - soldBags * p.bag;
    return { ...p, produced, soldBags, onHandKg, bags: Math.floor(onHandKg / p.bag) };
  });
}

/** v_egg_stock — graded in − non-sale outs − crates sold. */
export function eggStock(movements: EggMove[], invoices: Invoice[]) {
  const moved = movements.reduce(
    (a, m) => a + (m.type === "in" ? m.crates : -m.crates),
    0
  );
  const sold = invoices
    .filter((v) => v.product === "Eggs (crates)")
    .reduce((a, v) => a + v.qty, 0);
  return moved - sold;
}

/** v_customer_blocking_debt — pending invoices from before the current week. */
export function blockingDebt(
  invoices: Invoice[],
  weekStart: string
): Record<number, number> {
  const debt: Record<number, number> = {};
  invoices.forEach((v) => {
    if (v.status === "pending" && v.cust && v.date < weekStart)
      debt[v.cust] = (debt[v.cust] || 0) + v.qty * v.price;
  });
  return debt;
}

/** v_customer_week_usage — crates claimed this week (declined don't count). */
export function weekUsage(
  orders: EggOrder[],
  weekStart: string
): Record<number, number> {
  const usage: Record<number, number> = {};
  orders.forEach((o) => {
    if (o.status !== "declined" && o.date >= weekStart)
      usage[o.cust] = (usage[o.cust] || 0) + o.crates;
  });
  return usage;
}

/** v_inventory_position — receipts − consumption per item. */
export function inventoryPositions(invItems: InvItem[], invMoves: InvMove[]) {
  return invItems.map((it) => {
    const mv = invMoves.filter((m) => m.item === it.id);
    const recv = mv.filter((m) => m.from === null).reduce((a, m) => a + m.qty, 0);
    const used = mv.filter((m) => m.to === null).reduce((a, m) => a + m.qty, 0);
    const onHand = recv - used;
    const st = onHand <= 0 ? "out" : onHand < it.reorder ? "low" : "in-stock";
    return { ...it, onHand, st, value: onHand * it.cost };
  });
}

/** Customer aggregates: owed, lifetime, weekly usage, debt hold. */
export function customerAggregates(
  customers: Customer[],
  invoices: Invoice[],
  orders: EggOrder[],
  weekStart: string
) {
  const debt = blockingDebt(invoices, weekStart);
  const usage = weekUsage(orders, weekStart);
  return customers.map((c) => {
    const inv = invoices.filter((v) => v.cust === c.id);
    const owed = inv
      .filter((v) => v.status === "pending")
      .reduce((a, v) => a + v.qty * v.price, 0);
    const lifetime = inv.reduce((a, v) => a + v.qty * v.price, 0);
    return { ...c, owed, lifetime, used: usage[c.id] || 0, hold: !!debt[c.id] };
  });
}

export function activeBirds(batches: Batch[]) {
  return batches
    .filter((b) => b.st === "active")
    .reduce((a, b) => a + b.birds - b.mortality, 0);
}

export function todaysEggs(prodLog: ProdEntry[], today: string) {
  return prodLog.filter((p) => p.date === today).reduce((a, p) => a + p.eggs, 0);
}

/** House occupancy — derived from the batches assigned to each house. */
export function houseOccupancy(houses: House[], batches: Batch[]) {
  return houses.map((h) => {
    const assigned = batches.filter(
      (b) => b.house === h.code && b.st === "active"
    );
    const birds = assigned.reduce((a, b) => a + b.birds - b.mortality, 0);
    return {
      ...h,
      birds,
      batch: assigned.map((b) => b.batch).join(", ") || "—",
      utilisation: h.capacity ? (100 * birds) / h.capacity : 0,
    };
  });
}

/** Layers feed position: external deliveries + mill internal sales − use. */
export function layersFeedPosition(
  external: LayersFeedDelivery[],
  feedSales: FeedSale[],
  products: Product[],
  feedUse: FeedUse[]
) {
  const externalKg = external.reduce((a, d) => a + d.kg, 0);
  const fromMill = feedSales
    .filter((s) => s.channel === "internal" && s.buyer === "Layers")
    .reduce(
      (a, s) => a + s.bags * (products.find((p) => p.id === s.product)?.bag ?? 0),
      0
    );
  const used = feedUse.reduce((a, u) => a + u.kg, 0);
  const stockKg = externalKg + fromMill - used;
  const latest = feedUse.reduce((m, u) => (u.date > m ? u.date : m), "");
  const usedToday = feedUse
    .filter((u) => u.date === latest)
    .reduce((a, u) => a + u.kg, 0);
  const days = new Set(feedUse.map((u) => u.date)).size || 1;
  const dailyAvg = used / days;
  return {
    external: externalKg,
    fromMill,
    used,
    stockKg,
    usedToday,
    daysCover: dailyAvg > 0 ? Math.floor(Math.max(0, stockKg) / dailyAvg) : 0,
  };
}

/**
 * "What can I make?" — the recipe derives from each product's LATEST run;
 * current ingredient stock caps the batch; the tightest ingredient is the
 * bottleneck.
 */
export function capacityPositions(
  products: Product[],
  runs: Run[],
  ingredients: Ingredient[],
  deliveries: Delivery[]
) {
  const ingPos = ingredientPositions(ingredients, deliveries, runs);
  return products
    .map((p) => {
      const latest = [...runs]
        .filter((r) => r.product === p.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!latest) return null;
      const charged = latest.lines.reduce((a, l) => a + l[1], 0);
      const lines = latest.lines.map(([ingId, kg]) => {
        const share = kg / charged;
        const onHand = ingPos.find((i) => i.id === ingId)?.onHand ?? 0;
        return {
          ing: ingredients.find((i) => i.id === ingId)!,
          sharePct: 100 * share,
          onHand,
          allows: share > 0 ? Math.max(0, onHand) / share : Infinity,
        };
      });
      const maxMixKg = Math.min(...lines.map((l) => l.allows));
      const bottleneck = lines.find((l) => l.allows === maxMixKg)?.ing.name ?? "—";
      return {
        product: p,
        sourceRun: latest.run,
        lines,
        maxMixKg,
        bags: Math.floor(maxMixKg / p.bag),
        bottleneck,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}
