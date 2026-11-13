import { canSee } from "@farm/access";
import { blockingDebt, finishedPositions, fmtBags, fmtK, fmtN, ingredientPositions, receivablesOf, runPositions } from "@farm/erp/derive";
import { divisionSummary, monthlySummary } from "@farm/erp/finance";
import type { ErpData } from "@farm/erp/types";

import { Card, CardTitle, Tile } from "@/components/card";
import { BarChart } from "@/components/charts";
import { View } from "react-native";
import { dayName } from "@/farm/day";
import { lastDays, moneySeries } from "@/farm/series";
import { space } from "@/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Naira, with a proper minus for a loss. */
export const fmtMoney = (n: number) => (n < 0 ? `−${fmtN(-n)}` : fmtN(n));

/** The month's money across the farm, as the website's dashboard works it out. */
export function moneyNow(S: ErpData) {
  const month = S.today.slice(0, 7);
  const inMonth = (d?: string) => !!d && d.slice(0, 7) === month;
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const finance = canSee(S.viewer.grants, "finance");
  const layers = finance ? monthlySummary(S, month) : null;
  const others = finance ? divisionSummary(S, month) : null;
  return {
    monthName: MONTHS[Number(month.slice(5, 7)) - 1],
    sales: sum(S.invoices.filter((v) => inMonth(v.date)), (v) => v.qty * v.price),
    collected: sum(S.payments.filter((p) => inMonth(p.date) && p.method !== "credit"), (p) => p.amount),
    owed: receivablesOf(S.invoices),
    onHold: Object.keys(blockingDebt(S.invoices, S.weekStart)).length,
    /** Income less costs for the month; null for those who don't see Finance. */
    net: layers && others ? layers.totals.net + (layers.growing.length ? layers.growers.net : 0) + others.total.net : null,
  };
}

/** Sales day by day, and the month's sales, money in, money owed and profit. */
export function MoneyCard({ S }: { S: ErpData }) {
  const m = moneyNow(S);
  const days = moneySeries(S, lastDays(S.today, 14));
  return (
    <Card>
      <CardTitle sub="Sales each day, last 14 days">{`Money in ${m.monthName}`}</CardTitle>
      <BarChart points={days.map((d) => ({ key: d.day, label: dayName(d.day, S.today), value: d.sales || null }))} format={fmtN} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Tile icon="sale" label="Sold this month" value={fmtN(m.sales)} />
        <Tile icon="check" label="Collected" value={fmtN(m.collected)} />
        <Tile icon="clock" label="Owed to the farm" value={fmtN(m.owed)} tone={m.onHold ? "warn" : undefined} />
        {m.net !== null ? <Tile icon="trends" label={m.net < 0 ? "Loss this month" : "Profit this month"} value={fmtMoney(m.net)} tone={m.net < 0 ? "warn" : undefined} /> : null}
      </View>
    </Card>
  );
}

/** Goats, sheep and cattle: how many, and what changed this month. */
export function RuminantsCard({ S }: { S: ErpData }) {
  const month = S.today.slice(0, 7);
  const inMonth = (d?: string) => !!d && d.slice(0, 7) === month;
  const herd = S.animals.filter((a) => a.status === "active");
  const species = [...new Set(herd.map((a) => a.species))].map((sp) => `${herd.filter((a) => a.species === sp).length} ${sp}`);
  return (
    <Card>
      <CardTitle sub={species.join(" · ") || "No animals on the farm"}>Ruminants</CardTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Tile icon="bird" label="On the farm" value={`${fmtK(herd.length)} animals`} />
        <Tile icon="check" label="Born this month" value={fmtK(S.animals.filter((a) => a.source === "born" && inMonth(a.joined)).length)} />
        <Tile icon="alert" label="Died or culled" value={fmtK(S.animals.filter((a) => (a.status === "died" || a.status === "culled") && inMonth(a.leftOn)).length)} />
        <Tile icon="sale" label="Sold this month" value={fmtK(S.animals.filter((a) => a.status === "sold" && inMonth(a.leftOn)).length)} />
      </View>
    </Card>
  );
}

/** The feed mill: what it made, what's in stock, and who's waiting on it. */
export function MillCard({ S }: { S: ErpData }) {
  const month = S.today.slice(0, 7);
  const made = runPositions(S.runs, S.products).filter((r) => r.date.slice(0, 7) === month).reduce((a, r) => a + r.output, 0);
  const finishedKg = finishedPositions(S.products, S.runs, S.feedSales).reduce((a, p) => a + Math.max(0, p.onHandKg), 0);
  const waiting = S.reqs.filter((q) => q.status === "pending").length;
  const low = ingredientPositions(S.ingredients, S.deliveries, S.runs).filter((i) => i.st !== "in-stock").length;
  return (
    <Card>
      <CardTitle sub="Feed made on the farm">Feed mill</CardTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Tile icon="feed" label="Made this month" value={fmtBags(made, S.feedBagKg)} />
        <Tile icon="store" label="Finished feed" value={fmtBags(finishedKg, S.feedBagKg)} />
        <Tile icon="clock" label="Requests waiting" value={String(waiting)} tone={waiting ? "warn" : undefined} />
        <Tile icon="alert" label="Ingredients low" value={String(low)} tone={low ? "warn" : undefined} />
      </View>
    </Card>
  );
}
