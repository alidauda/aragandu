import type { BirdUnit, ErpData } from "@farm/erp/types";

/** Broilers and Brooding keep the same records: this narrows them to one unit's (as the website's pages do). */
export function unitView(S: ErpData, unit: BirdUnit) {
  const batches = S.broilerBatches.filter((b) => b.unit === unit);
  const codes = new Set(batches.map((b) => b.batch));
  const own = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => codes.has(r.batch));
  return {
    ...S,
    broilerBatches: batches,
    broilerDaily: own(S.broilerDaily),
    broilerWeighings: own(S.broilerWeighings),
    broilerSales: own(S.broilerSales),
    broilerProcessing: own(S.broilerProcessing),
    broodingDispatches: own(S.broodingDispatches),
    broilerFeedDeliveries: S.broilerFeedDeliveries.filter((d) => d.unit === unit),
    broilerExpenses: S.broilerExpenses.filter((e) => e.unit === unit),
  };
}
