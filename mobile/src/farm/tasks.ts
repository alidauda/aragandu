import type { Href } from "expo-router";

import { canAct, type Area, type Grants } from "@farm/access";
import type { ErpData } from "@farm/erp/types";

import type { IconName } from "@/components/icon";

import { unitView } from "./unit";

export type Task = {
  key: string;
  href: Href;
  icon: IconName;
  title: string;
  /** A word or two, under a round button. */
  short: string;
  sub: string;
  /** For a once-a-day record: whether today's is in. Absent for the rest. */
  doneToday?: boolean;
};

const sells = (g: Grants) => (["eggsales", "broilersales", "broodingsales", "ruminantsales"] as const).some((a) => canAct(g, a, "staff")) || canAct(g, "money", "admin");

/** Whether today's daily records are in, for each part that has birds (absent: nothing to record there). */
export function enteredToday(S: ErpData): { layers?: boolean; broilers?: boolean; brooding?: boolean } {
  const birds = (unit: "broilers" | "brooding") => {
    const v = unitView(S, unit);
    return v.broilerBatches.some((b) => b.st === "active") ? v.broilerDaily.some((r) => r.date === S.today) : undefined;
  };
  return {
    layers: S.batches.some((b) => b.st === "active") ? S.prodLog.some((p) => p.date === S.today) : undefined,
    broilers: birds("broilers"),
    brooding: birds("brooding"),
  };
}

/** What this person can record in the app, with today's daily records marked done or not. */
export function tasksFor(S: ErpData): Task[] {
  const g = S.viewer.grants;
  const can = (a: Area) => canAct(g, a, "staff");
  const done = enteredToday(S);
  const all: (Task | false)[] = [
    can("layers") && { key: "layers", href: "/layers-daily", icon: "egg", title: "Layers daily entry", short: "Layers", sub: "Eggs, feed, water and mortality for each flock", doneToday: done.layers },
    can("layers") && { key: "sort", href: "/sort-eggs", icon: "sort", title: "Sort eggs", short: "Sort eggs", sub: "Good crates into the store, and cracks" },
    can("eggsales") && { key: "sale", href: "/sell-eggs", icon: "sale", title: "Record an egg sale", short: "Sale", sub: "Crates or cracked eggs, to a walk-in or a buyer" },
    sells(g) && { key: "receipt", href: "/receipts", icon: "receipt", title: "Add a receipt", short: "Receipt", sub: "Photograph a buyer's payment receipt for an unpaid sale" },
    can("broilers") && { key: "broilers", href: "/birds-daily/broilers", icon: "bird", title: "Broilers daily entry", short: "Broilers", sub: "Feed, water, mortality and weights for each batch", doneToday: done.broilers },
    can("brooding") && { key: "brooding", href: "/birds-daily/brooding", icon: "chick", title: "Brooding daily entry", short: "Brooding", sub: "Feed, water, mortality and weights for each batch", doneToday: done.brooding },
  ];
  return all.filter((t): t is Task => !!t);
}
