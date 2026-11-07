/**
 * The farm's finance, worked the way the finance manager does it on the
 * monthly "Summary of Financial Report":
 *   total sales = eggs + manure + culls and other income
 *   net         = total sales − bags of feed × the month's price per bag
 * Salaries and other shared costs stay below the line, not split by flock.
 * A flock not laying yet goes on its own, with the costs set against it.
 * Eggs sell from one store, so a flock's egg sales are its crates × the
 * month's average selling price.
 */
import { BROILER_PRODUCTS, PULLET_PRODUCT, RUMINANT_PRODUCTS } from "./broilers";
import { ageOn, feedCostPerCrate, runPositions } from "./derive";
import { isDivisionBuyer } from "./divisions";
import type { ErpData } from "./types";

export const EXPENSE_CATEGORIES = [
  { key: "salary", label: "Farm salary" },
  { key: "manure", label: "Manure cost" },
  { key: "medication", label: "Medication and vaccines" },
  { key: "transport", label: "Transportation" },
  { key: "running", label: "Running cost" },
  { key: "maintenance", label: "Maintenance" },
  { key: "tools", label: "Tools and equipment" },
  { key: "other", label: "Other expenses" },
  { key: "mill_wages", label: "Feed mill wages", mill: true },
  { key: "mill_power", label: "Mill diesel and electricity", mill: true },
  { key: "mill_tools", label: "Mill tools", mill: true },
  { key: "mill_sacks", label: "Empty sacks", mill: true },
] as const;

export const INCOME_CATEGORIES = [
  { key: "orchard", label: "Orchard sales" },
  { key: "other_income", label: "Other income" },
] as const;

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const MILL_KEYS: readonly string[] = EXPENSE_CATEGORIES.filter((c) => "mill" in c).map((c) => c.key);
/** Money with its kobo, as the finance manager records it: ₦553,466.6. */
export const fmtKobo = (n: number) => "₦" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export const categoryLabel = (key: string) =>
  ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

/** How eggs and sold birds are named on invoices. */
const EGG_PRODUCT = "Eggs (crates)";
export const SOLD_BIRDS = "Spent hens";

type Books = Pick<
  ErpData,
  | "batches"
  | "prodLog"
  | "feedUse"
  | "birdOuts"
  | "invoices"
  | "manure"
  | "financeEntries"
  | "financeMonths"
  | "eggsPerCrate"
  | "feedBagKg"
  | "cratePrice"
  | "layersFeedDeliveries"
  | "feedSales"
  | "products"
>;

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
export const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const invoiceTotal = (v: { qty: number; price: number }) => v.qty * v.price;

/** Manure bags: brought forward, made, sold and carried forward. */
function manureOf(d: Books, batch: string | undefined, month: string) {
  const mine = d.manure.filter((m) => m.batch === batch);
  const before = mine.filter((m) => m.date.slice(0, 7) < month);
  const now = mine.filter((m) => m.date.slice(0, 7) === month);
  const sold = now.filter((m) => m.kind === "sold");
  const bf = sum(before, (m) => (m.kind === "sold" ? -m.bags : m.bags));
  const made = sum(now.filter((m) => m.kind === "produced"), (m) => m.bags);
  const soldBags = sum(sold, (m) => m.bags);
  return { bf, made, total: bf + made, soldBags, sales: sum(sold, (m) => m.amount), cf: bf + made - soldBags };
}

/** The monthly summary: one line per flock, then the farm's shared costs. */
export function monthlySummary(d: Books, month: string) {
  const to = lastDay(month);
  const inMonth = <T extends { date: string }>(r: T) => r.date.slice(0, 7) === month;
  const prod = d.prodLog.filter(inMonth);
  const feed = d.feedUse.filter(inMonth);
  const entries = d.financeEntries.filter(inMonth);
  const invoices = d.invoices.filter(inMonth);

  const eggSold = invoices.filter((v) => v.product === EGG_PRODUCT);
  const cratesSold = sum(eggSold, (v) => v.qty);
  const actualEggSales = sum(eggSold, invoiceTotal);
  const cratePrice = cratesSold ? actualEggSales / cratesSold : d.cratePrice;

  const saved = d.financeMonths.find((m) => m.month === month);
  const worked = Math.round(
    feedCostPerCrate({ external: d.layersFeedDeliveries, feedSales: d.feedSales, products: d.products, feedUse: [], moves: [] }, month, month)
      .perKg * d.feedBagKg
  );
  const price = { layer: saved?.layerBag ?? worked, grower: saved?.growerBag ?? worked, saved: !!saved };

  const flocks = d.batches
    .filter((b) => b.received <= to)
    .map((b) => {
      const growing = !b.inLay || b.inLay > to;
      const good = sum(prod.filter((p) => p.batch === b.batch), (p) => p.eggs - p.cracked - p.rejects - p.withheld);
      const crates = good / d.eggsPerCrate;
      const eggSales = crates * cratePrice;
      const manure = manureOf(d, b.batch, month);
      const bags = sum(feed.filter((f) => f.batch === b.batch), (f) => f.kg) / d.feedBagKg;
      const feedCost = bags * (growing ? price.grower : price.layer);
      const birdsLater = sum(d.birdOuts.filter((o) => o.batch === b.batch && o.date > to), (o) => o.birds);
      const totalSales = eggSales + manure.sales;
      return {
        batch: b.batch,
        breed: b.breed,
        birds: b.birds - b.mortality + birdsLater,
        ageDays: ageOn(b, to),
        growing,
        status: b.st,
        good,
        crates,
        eggSales,
        manure,
        totalSales,
        bags,
        feedCost,
        net: totalSales - feedCost,
      };
    })
    .filter((f) => f.status === "active" || f.good || f.bags || f.manure.total);

  const growingCodes = new Set(flocks.filter((f) => f.growing).map((f) => f.batch));

  // Costs against one flock keep their own line; the rest add up by category.
  const costLines = (rows: typeof entries) => {
    const lines = new Map<string, number>();
    const order = (e: (typeof rows)[number]) => (e.batch ? 99 : ALL_CATEGORIES.findIndex((c) => c.key === e.category));
    for (const e of [...rows].sort((a, b) => order(a) - order(b))) {
      const label = e.batch ? `${e.batch} — ${e.description}` : categoryLabel(e.category);
      lines.set(label, (lines.get(label) ?? 0) + e.amount);
    }
    return [...lines].map(([label, amount]) => ({ label, amount }));
  };
  const expenses = entries.filter((e) => e.kind === "expense");
  const farmCosts = costLines(expenses.filter((e) => !e.batch || !growingCodes.has(e.batch)));
  const growerCosts = costLines(expenses.filter((e) => e.batch && growingCodes.has(e.batch)));

  const cullIncome = sum(invoices.filter((v) => v.product === SOLD_BIRDS), invoiceTotal);
  const otherIncome = costLines(entries.filter((e) => e.kind === "income").map((e) => ({ ...e, batch: undefined })));
  const reserve = manureOf(d, undefined, month);

  const laying = flocks.filter((f) => !f.growing);
  const growing = flocks.filter((f) => f.growing);
  const sales =
    sum(laying, (f) => f.totalSales) + reserve.sales + cullIncome + sum(otherIncome, (l) => l.amount);
  const feedCost = sum(laying, (f) => f.feedCost);
  const sharedCost = sum(farmCosts, (l) => l.amount);
  const growerSales = sum(growing, (f) => f.totalSales);
  const growerFeed = sum(growing, (f) => f.feedCost);
  const growerExtra = sum(growerCosts, (l) => l.amount);

  return {
    month,
    to,
    price,
    cratePrice,
    cratesSold,
    actualEggSales,
    laying,
    growing,
    reserve,
    cullIncome,
    otherIncome,
    farmCosts,
    growerCosts,
    totals: {
      sales,
      feedCost,
      /** Sales less feed, before the shared costs. */
      subtotalNet: sales - feedCost,
      sharedCost,
      costs: feedCost + sharedCost,
      net: sales - feedCost - sharedCost,
    },
    growers: {
      sales: growerSales,
      feedCost: growerFeed,
      costs: growerFeed + growerExtra,
      net: growerSales - growerFeed - growerExtra,
    },
    /** Eggs and feed not linked to a flock aren't in the lines above. */
    unlinked: {
      eggs: sum(prod.filter((p) => !p.batch), (p) => p.eggs),
      bags: sum(feed.filter((f) => !f.batch), (f) => f.kg) / d.feedBagKg,
    },
  };
}

/**
 * A batch from start to finish: what it cost to buy, every month's analysis,
 * and what its birds fetch — sold so far, plus those left at the expected
 * price. Shared farm costs aren't split, so they aren't in here.
 */
export function batchEstimates(d: Books & Pick<ErpData, "batchCosts">, today: string) {
  const first = d.batches.reduce((a, b) => (b.received < a ? b.received : a), today).slice(0, 7);
  const months: string[] = [];
  for (let m = first; m <= today.slice(0, 7); ) {
    months.push(m);
    const [y, mm] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7);
  }
  const summaries = months.map((m) => monthlySummary(d, m));
  return d.batches.map((b) => {
    const rows = summaries.flatMap((s) => [...s.laying, ...s.growing]).filter((f) => f.batch === b.batch);
    const cost = d.batchCosts.find((c) => c.batch === b.batch);
    const purchaseCost = cost?.purchaseCost ?? 0;
    const birdPrice = cost?.birdPrice ?? 0;
    const eggSales = sum(rows, (r) => r.eggSales);
    const manureSales = sum(rows, (r) => r.manure.sales);
    const feedCost = sum(rows, (r) => r.feedCost);
    const expenses = sum(d.financeEntries.filter((e) => e.kind === "expense" && e.batch === b.batch), (e) => e.amount);
    const soldInvoices = new Set(
      d.birdOuts.flatMap((o) => (o.batch === b.batch && o.invoiceId ? [o.invoiceId] : []))
    );
    const birdSales = sum(d.invoices.filter((v) => soldInvoices.has(v.id)), invoiceTotal);
    const birdsLeft = b.st === "active" ? b.birds - b.mortality : 0;
    const expectedSale = birdsLeft * birdPrice;
    const income = eggSales + manureSales + birdSales + expectedSale;
    const costs = purchaseCost + feedCost + expenses;
    return {
      batch: b.batch,
      breed: b.breed,
      status: b.st,
      placed: b.birds,
      purchaseCost,
      birdPrice,
      eggSales,
      manureSales,
      feedCost,
      expenses,
      birdSales,
      birdsLeft,
      expectedSale,
      income,
      costs,
      net: income - costs,
      /** It needs a purchase cost, and a price while birds remain. */
      complete: purchaseCost > 0 && (birdsLeft === 0 || birdPrice > 0),
    };
  });
}

/** The mill's month: ingredients and running costs against what its bags sell for. */
export function millSummary(d: Pick<ErpData, "runs" | "products" | "feedSales" | "financeEntries">, month: string) {
  const inMonth = <T extends { date: string }>(r: T) => r.date.slice(0, 7) === month;
  const runs = runPositions(d.runs.filter(inMonth), d.products);
  const running = d.financeEntries.filter((e) => inMonth(e) && e.kind === "expense" && MILL_KEYS.includes(e.category));
  const runningCost = sum(running, (e) => e.amount);
  const made = (id: number, bag: number) => sum(runs.filter((r) => r.product === id), (r) => r.output) / bag;
  const totalBags = sum(d.products, (p) => made(p.id, p.bag));
  const products = d.products
    .map((p) => {
      const bags = made(p.id, p.bag);
      const sales = d.feedSales.filter((s) => inMonth(s) && s.product === p.id);
      const soldBags = sum(sales, (s) => s.bags);
      const sold = sum(sales, (s) => s.bags * s.price);
      const sellPrice = soldBags ? sold / soldBags : p.price;
      const ingredients = sum(runs.filter((r) => r.product === p.id), (r) => r.cost);
      const runningShare = totalBags ? (runningCost * bags) / totalBags : 0;
      const cost = ingredients + runningShare;
      return {
        id: p.id,
        name: p.name,
        bagKg: p.bag,
        bags,
        ingredients,
        runningShare,
        cost,
        costPerBag: bags ? cost / bags : 0,
        sellPrice,
        soldBags,
        value: bags * sellPrice,
        margin: bags * sellPrice - cost,
      };
    })
    .filter((p) => p.bags || p.soldBags);
  const lines = EXPENSE_CATEGORIES.filter((c) => MILL_KEYS.includes(c.key))
    .map((c) => ({
      label: c.label,
      amount: sum(running.filter((e) => e.category === c.key), (e) => e.amount),
    }))
    .filter((l) => l.amount);
  return {
    products,
    lines,
    runningCost,
    totals: {
      bags: totalBags,
      ingredients: sum(products, (p) => p.ingredients),
      cost: sum(products, (p) => p.cost),
      value: sum(products, (p) => p.value),
      margin: sum(products, (p) => p.margin),
    },
  };
}

/** The average cost of a kg of a unit's feed, from everything it received (bought in and from the mill). */
export function feedCostPerKg(
  d: Pick<ErpData, "broilerFeedDeliveries" | "feedSales" | "products">,
  unit: "broilers" | "brooding" | "ruminants"
) {
  const bought = d.broilerFeedDeliveries.filter((x) => x.unit === unit);
  const mill = d.feedSales.filter((s) => s.channel === "internal" && isDivisionBuyer(s.buyer, unit));
  const bag = (id: number) => d.products.find((p) => p.id === id)?.bag ?? 0;
  const kgIn = sum(bought, (x) => x.kg) + sum(mill, (s) => s.bags * bag(s.product));
  const costIn = sum(bought, (x) => x.kg * x.pricePerKg) + sum(mill, (s) => s.bags * s.price);
  return kgIn ? costIn / kgIn : 0;
}

/**
 * Broilers, Brooding and Ruminants for a month: what they sold, the feed they
 * ate at the average cost of their feed (bought in and from the mill), and
 * their expenses (with Broilers' cost of processing). Birds Brooding sends to
 * Layers or Broilers move inside the farm, so they aren't sales.
 */
export function divisionSummary(
  d: Pick<
    ErpData,
    | "invoices"
    | "broilerBatches"
    | "broilerDaily"
    | "broilerExpenses"
    | "broilerFeedDeliveries"
    | "broilerProcessing"
    | "ruminantFeed"
    | "feedSales"
    | "products"
  >,
  month: string
) {
  const inMonth = <T extends { date: string }>(r: T) => r.date.slice(0, 7) === month;
  const unitOf = new Map(d.broilerBatches.map((b) => [b.batch, b.unit]));
  const units = [
    { unit: "broilers", label: "Broilers", products: BROILER_PRODUCTS },
    { unit: "brooding", label: "Brooding", products: [PULLET_PRODUCT] },
    { unit: "ruminants", label: "Ruminants", products: RUMINANT_PRODUCTS },
  ] as const;
  const rows = units.map((u) => {
    const perKg = feedCostPerKg(d, u.unit);
    const feedKg =
      u.unit === "ruminants"
        ? sum(d.ruminantFeed.filter(inMonth), (f) => f.kg)
        : sum(d.broilerDaily.filter((r) => inMonth(r) && unitOf.get(r.batch) === u.unit), (r) => r.feedKg);
    const sales = sum(d.invoices.filter((v) => inMonth(v) && (u.products as readonly string[]).includes(v.product)), invoiceTotal);
    const expenses =
      sum(d.broilerExpenses.filter((e) => inMonth(e) && e.unit === u.unit), (e) => e.amount) +
      (u.unit === "broilers" ? sum(d.broilerProcessing.filter(inMonth), (p) => p.cost) : 0);
    const feedCost = feedKg * perKg;
    return { unit: u.unit, label: u.label, sales, feedKg, perKg, feedCost, expenses, net: sales - feedCost - expenses };
  });
  return {
    rows,
    total: {
      sales: sum(rows, (r) => r.sales),
      feedCost: sum(rows, (r) => r.feedCost),
      expenses: sum(rows, (r) => r.expenses),
      net: sum(rows, (r) => r.net),
    },
  };
}

/**
 * A broiler or brooding batch from start to finish: what it cost to buy,
 * its feed at the average cost of its unit's feed, its own expenses and the
 * cost of processing it, against its live sales, its share of processed
 * chicken sold (by the carcass it gave), and its birds left at the expected
 * price. Birds Brooding sent on move inside the farm, so they aren't sales.
 */
export function broilerBatchEstimates(
  d: Pick<
    ErpData,
    | "broilerBatches"
    | "broilerBatchCosts"
    | "broilerDaily"
    | "broilerSales"
    | "broilerProcessing"
    | "broilerExpenses"
    | "broodingDispatches"
    | "invoices"
    | "processedSales"
    | "broilerFeedDeliveries"
    | "feedSales"
    | "products"
  >
) {
  const invoice = new Map(d.invoices.map((v) => [v.id, v]));
  const totalCarcass = sum(d.broilerProcessing, (p) => p.carcassKg);
  const processedSold = sum(d.processedSales, (x) => {
    const v = invoice.get(x.invoiceId);
    return v ? invoiceTotal(v) : 0;
  });
  const perKg = { broilers: feedCostPerKg(d, "broilers"), brooding: feedCostPerKg(d, "brooding") };
  return d.broilerBatches.map((b) => {
    const mine = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => r.batch === b.batch);
    const cost = d.broilerBatchCosts.find((c) => c.batch === b.batch);
    const purchaseCost = cost?.purchaseCost ?? 0;
    const birdPrice = cost?.birdPrice ?? 0;
    const daily = mine(d.broilerDaily);
    const processing = mine(d.broilerProcessing);
    const feedKg = sum(daily, (r) => r.feedKg);
    const feedCost = feedKg * perKg[b.unit];
    const expenses = sum(d.broilerExpenses.filter((e) => e.batch === b.batch), (e) => e.amount) + sum(processing, (p) => p.cost);
    const liveSales = sum(mine(d.broilerSales), (x) => {
      const v = invoice.get(x.invoiceId);
      return v ? invoiceTotal(v) : 0;
    });
    const carcass = sum(processing, (p) => p.carcassKg);
    const processedShare = totalCarcass ? (processedSold * carcass) / totalCarcass : 0;
    const out =
      sum(daily, (r) => r.died + r.culled) +
      sum(mine(d.broilerSales), (x) => x.birds) +
      sum(processing, (p) => p.birds) +
      sum(mine(d.broodingDispatches), (x) => x.birds);
    const birdsLeft = b.st === "active" ? b.birds - out : 0;
    const expectedSale = birdsLeft * birdPrice;
    const income = liveSales + processedShare + expectedSale;
    const costs = purchaseCost + feedCost + expenses;
    return {
      batch: b.batch,
      unit: b.unit,
      breed: b.breed,
      status: b.st,
      placed: b.birds,
      purchaseCost,
      birdPrice,
      feedKg,
      feedCost,
      expenses,
      liveSales,
      processedShare,
      sentOn: sum(mine(d.broodingDispatches), (x) => x.birds),
      birdsLeft,
      expectedSale,
      income,
      costs,
      net: income - costs,
      complete: purchaseCost > 0 && (birdsLeft === 0 || birdPrice > 0),
    };
  });
}
