"use client";

import { usePathname } from "next/navigation";

import { UNIT } from "@/lib/erp/broilers";
import { useErp } from "@/lib/erp/store";
import type { BirdUnit } from "@/lib/erp/types";

/**
 * Broilers and Brooding run on the same pages and records: the page's path
 * says which unit it is, and this narrows the data to that unit's.
 */
export function useBirdUnit() {
  const S = useErp();
  const unit: BirdUnit = usePathname().startsWith("/brooding") ? "brooding" : "broilers";
  const batches = S.broilerBatches.filter((b) => b.unit === unit);
  const codes = new Set(batches.map((b) => b.batch));
  const mine = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => codes.has(r.batch));
  return {
    ...S,
    unit,
    u: UNIT[unit],
    broilerHouses: S.broilerHouses.filter((h) => h.unit === unit),
    broilerBatches: batches,
    broilerDaily: mine(S.broilerDaily),
    broilerWeighings: mine(S.broilerWeighings),
    broilerSales: mine(S.broilerSales),
    broilerHealth: mine(S.broilerHealth),
    broilerProcessing: mine(S.broilerProcessing),
    broodingDispatches: mine(S.broodingDispatches),
    broilerFeedDeliveries: S.broilerFeedDeliveries.filter((d) => d.unit === unit),
    broilerExpenses: S.broilerExpenses.filter((e) => e.unit === unit),
  };
}
