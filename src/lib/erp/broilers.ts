/**
 * Broilers: batches raised for meat over a few weeks. What matters is
 * weight — the average from sample weighing, feed per kg gained (FCR),
 * the birds still alive, and the live weight sold.
 */
import { addDays, ageOn } from "./derive";
import { isDivisionBuyer } from "./divisions";
import type { BroilerBatch, BroilerDaily, BroilerSale, BroilerWeighing, ErpData } from "./types";

/** How broilers are named on invoices. */
export const BROILER_PRODUCT = "Broilers";

export const BROILER_BREEDS = ["Arbor Acres", "Cobb 500", "Ross 308", "Hubbard"];

/** A weight in kg: "2.345 kg" (— when unknown). */
export const fmtKg = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} kg`;

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

/** Birds in a batch now: placed, less deaths, culls and sales. */
export function broilersAlive(b: BroilerBatch, daily: BroilerDaily[], sales: BroilerSale[]) {
  const mine = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => r.batch === b.batch);
  return b.birds - sum(mine(daily), (r) => r.died + r.culled) - sum(mine(sales), (s) => s.birds);
}

/** Average weight of a weighing, in kg. */
export const avgKg = (w: Pick<BroilerWeighing, "birds" | "kg">) => (w.birds ? w.kg / w.birds : 0);

/**
 * Each batch's performance:
 *   liveability = birds not dead or culled ÷ placed
 *   FCR         = feed ÷ live weight produced (sold + on the farm − chicks' weight)
 *   EPEF        = liveability % × average kg × 100 ÷ (age in days × FCR)
 */
export function broilerStats(
  d: Pick<ErpData, "broilerBatches" | "broilerDaily" | "broilerWeighings" | "broilerSales">,
  today: string
) {
  return d.broilerBatches.map((b) => {
    const mine = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => r.batch === b.batch);
    const daily = mine(d.broilerDaily);
    const sales = mine(d.broilerSales);
    const weighings = mine(d.broilerWeighings).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);
    const died = sum(daily, (r) => r.died);
    const culled = sum(daily, (r) => r.culled);
    const feedKg = sum(daily, (r) => r.feedKg);
    const litres = sum(daily, (r) => r.litres);
    const soldBirds = sum(sales, (s) => s.birds);
    const soldKg = sum(sales, (s) => s.kg);
    const alive = b.birds - died - culled - soldBirds;
    const last = weighings.at(-1);
    const end = b.st === "closed" && b.closedAt ? b.closedAt : today;
    const ageDays = ageOn(b, end);
    // A closed batch's weight is what it sold at; otherwise the last weighing.
    const weightKg = b.st === "closed" && soldBirds ? soldKg / soldBirds : last ? avgKg(last) : null;
    const weighedAge = last ? ageOn(b, last.date) : null;
    const onFarmKg = last ? alive * avgKg(last) : 0;
    const produced = soldKg + onFarmKg - (b.birds * b.chickWeight) / 1000;
    const fcr = feedKg > 0 && produced > 0 ? feedKg / produced : null;
    const liveability = b.birds ? (100 * (b.birds - died - culled)) / b.birds : 0;
    const daysIn = last ? Math.round((Date.parse(last.date) - Date.parse(b.received)) / 86_400_000) : 0;
    const epefAge = b.st === "closed" ? ageDays : weighedAge;
    return {
      batch: b.batch,
      breed: b.breed,
      house: b.house,
      status: b.st,
      received: b.received,
      placed: b.birds,
      ageDays,
      alive,
      died,
      culled,
      soldBirds,
      soldKg,
      feedKg,
      litres,
      weighings: weighings.length,
      lastWeighed: last?.date,
      weightKg,
      /** Grams a bird a day, from arrival to the last weighing. */
      dailyGain: last && daysIn > 0 ? (avgKg(last) * 1000 - b.chickWeight) / daysIn : null,
      onFarmKg,
      produced,
      fcr,
      liveability,
      mortalityPct: b.birds ? (100 * died) / b.birds : 0,
      epef: fcr && weightKg && epefAge ? (liveability * weightKg * 100) / (epefAge * fcr) : null,
    };
  });
}

/** Broiler feed: bought in + sent by the mill − used, and how long it lasts. */
export function broilerFeedPosition(d: Pick<ErpData, "broilerFeedDeliveries" | "feedSales" | "products" | "broilerDaily">, today: string) {
  const external = sum(d.broilerFeedDeliveries, (x) => x.kg);
  const fromMill = sum(
    d.feedSales.filter((s) => s.channel === "internal" && isDivisionBuyer(s.buyer, "broilers")),
    (s) => s.bags * (d.products.find((p) => p.id === s.product)?.bag ?? 0)
  );
  const used = sum(d.broilerDaily, (r) => r.feedKg);
  const stockKg = external + fromMill - used;
  const weekAgo = addDays(today, -6);
  const recent = d.broilerDaily.filter((r) => r.date >= weekAgo && r.date <= today && r.feedKg > 0);
  const recentDays = new Set(recent.map((r) => r.date)).size;
  const dailyAvg = recentDays ? sum(recent, (r) => r.feedKg) / recentDays : 0;
  return {
    external,
    fromMill,
    used,
    stockKg,
    usedToday: sum(d.broilerDaily.filter((r) => r.date === today), (r) => r.feedKg),
    daysCover: dailyAvg > 0 ? Math.floor(Math.max(0, stockKg) / dailyAvg) : 0,
  };
}
