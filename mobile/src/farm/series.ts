import { addDays, activeBirds } from "@farm/erp/derive";
import type { ErpData } from "@farm/erp/types";

import { unitView } from "./unit";

/** The last `n` days up to `today`, oldest first. */
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));

const sumBy = <T,>(rows: T[], day: string, f: (r: T) => number) => rows.reduce((a, r) => ((r as { date: string }).date === day ? a + f(r) : a), 0);

/** Layers, day by day: eggs, % production, birds lost and feed. */
export function layersSeries(S: ErpData, days: string[]) {
  return days.map((day) => {
    const eggs = sumBy(S.prodLog, day, (p) => p.eggs);
    const birds = activeBirds(S.batches, day, S.prodLog);
    const feedKg = sumBy(S.feedUse, day, (u) => u.kg);
    return {
      day,
      eggs,
      /** Null on a day with no eggs entered: a gap, not a zero. */
      pct: eggs > 0 && birds > 0 ? (100 * eggs) / birds : null,
      lost: sumBy(S.birdOuts.filter((o) => o.reason !== "sold"), day, (o) => o.birds),
      feedKg,
    };
  });
}

/** Broilers or Brooding, day by day: birds lost and feed. */
export function birdsSeries(S: ErpData, unit: "broilers" | "brooding", days: string[]) {
  const view = unitView(S, unit);
  return days.map((day) => ({
    day,
    lost: sumBy(view.broilerDaily, day, (r) => r.died + r.culled),
    feedKg: sumBy(view.broilerDaily, day, (r) => r.feedKg),
  }));
}

/** A batch's weighings as average weight per bird, oldest first. */
export function weightCurve(S: ErpData, batch: string) {
  return S.broilerWeighings
    .filter((w) => w.batch === batch && w.birds > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((w) => ({ day: w.date, kg: w.kg / w.birds }));
}

/** Egg money day by day: what was sold, in naira. */
export function salesSeries(S: ErpData, days: string[]) {
  return days.map((day) => ({ day, naira: sumBy(S.invoices, day, (v) => v.qty * v.price) }));
}
