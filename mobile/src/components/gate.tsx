import type { ReactNode } from "react";

import { canAct, isViewOnly, type Area } from "@farm/access";
import type { ErpData } from "@farm/erp/types";

import { NoAccess } from "@/components/no-access";
import { WithData } from "@/components/with-data";

/** An entry page: loads the figures, and opens only for those who may record in that part of the farm. `wide` is for a page of several cards, which sit two across on a tablet. */
export function Gate({ area, wide, children }: { area: Area; wide?: boolean; children: (S: ErpData) => ReactNode }) {
  return <WithData narrow={!wide}>{(S) => (canAct(S.viewer.grants, area, "staff") ? children(S) : <NoAccess viewOnly={isViewOnly(S.viewer.grants, area)} executive={S.viewer.grants.farm === "view"} />)}</WithData>;
}
