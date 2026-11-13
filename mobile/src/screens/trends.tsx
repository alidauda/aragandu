import { useState } from "react";
import { View } from "react-native";

import { canSee, isFarmWide } from "@farm/access";
import { broilerStats, fmtKg, UNIT } from "@farm/erp/broilers";
import { fmtBags, fmtD, fmtEggs, fmtK, fmtN, receivablesOf } from "@farm/erp/derive";
import type { ErpData } from "@farm/erp/types";

import { Card, CardTitle, Figure } from "@/components/card";
import { BarChart, LineChart } from "@/components/charts";
import { Chips } from "@/components/chips";
import { Grid } from "@/components/grid";
import { Text } from "@/components/text";
import { dayName } from "@/farm/day";
import { birdsSeries, lastDays, layersSeries, moneySeries, weightCurve } from "@/farm/series";
import { unitView } from "@/farm/unit";
import { color, space } from "@/theme";

type Part = "layers" | "broilers" | "brooding" | "money";
const RANGES = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

function LayersTrends({ S, days }: { S: ErpData; days: string[] }) {
  const rows = layersSeries(S, days);
  const per = S.eggsPerCrate;
  const label = (day: string) => dayName(day, S.today);
  const eggs = rows.reduce((a, d) => a + d.eggs, 0);
  const laid = rows.filter((d) => d.pct !== null);
  return (
    <Grid>
      <Card>
        <CardTitle sub="Crates collected each day">Eggs</CardTitle>
        <BarChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.eggs ? d.eggs / per : null }))} format={(v) => fmtEggs(v * per, per)} />
        <Figure label={`Total, ${days.length} days`} value={fmtEggs(eggs, per)} />
      </Card>
      <Card>
        <CardTitle sub="Eggs for every 100 laying birds">% production</CardTitle>
        <LineChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.pct }))} format={(v) => `${v.toFixed(1)}%`} max={100} />
        <Figure label="Average" value={laid.length ? `${(laid.reduce((a, d) => a + (d.pct ?? 0), 0) / laid.length).toFixed(1)}%` : "—"} />
      </Card>
      <Card>
        <CardTitle sub="Died and culled each day">Birds lost</CardTitle>
        <BarChart tint={color.chart2} points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.lost }))} format={(v) => `${fmtK(v)} ${v === 1 ? "bird" : "birds"}`} />
        <Figure label={`Total, ${days.length} days`} value={fmtK(rows.reduce((a, d) => a + d.lost, 0))} />
      </Card>
      <Card>
        <CardTitle sub="Bags given each day">Feed</CardTitle>
        <BarChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.feedKg ? d.feedKg / S.feedBagKg : null }))} format={(v) => fmtBags(v * S.feedBagKg, S.feedBagKg)} />
        <Figure label={`Total, ${days.length} days`} value={fmtBags(rows.reduce((a, d) => a + d.feedKg, 0), S.feedBagKg)} />
      </Card>
    </Grid>
  );
}

function MoneyTrends({ S, days }: { S: ErpData; days: string[] }) {
  const rows = moneySeries(S, days);
  const label = (day: string) => dayName(day, S.today);
  return (
    <Grid>
      <Card>
        <CardTitle sub="What was sold each day, across the farm">Sales</CardTitle>
        <BarChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.sales || null }))} format={fmtN} />
        <Figure label={`Total, ${days.length} days`} value={fmtN(rows.reduce((a, d) => a + d.sales, 0))} />
      </Card>
      <Card>
        <CardTitle sub="Payments received each day">Money in</CardTitle>
        <BarChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.collected || null }))} format={fmtN} />
        <Figure label={`Total, ${days.length} days`} value={fmtN(rows.reduce((a, d) => a + d.collected, 0))} />
        <Figure label="Owed to the farm now" value={fmtN(receivablesOf(S.invoices))} />
      </Card>
    </Grid>
  );
}

function BirdsTrends({ S, unit, days }: { S: ErpData; unit: "broilers" | "brooding"; days: string[] }) {
  const view = unitView(S, unit);
  const stats = broilerStats(view, S.today).filter((b) => b.status === "active");
  const [picked, setPicked] = useState("");
  const batch = stats.find((b) => b.batch === picked) ?? stats[0];
  const rows = birdsSeries(S, unit, days);
  const label = (day: string) => dayName(day, S.today);
  if (!batch) {
    return (
      <Card>
        <Text style={{ color: color.body }}>No batches growing.</Text>
      </Card>
    );
  }
  const curve = weightCurve(S, batch.batch);
  return (
    <Grid>
      <Card>
        <CardTitle sub="Average weight of a bird at each weighing">Growth</CardTitle>
        {stats.length > 1 ? <Chips value={batch.batch} onChange={setPicked} options={stats.map((b) => ({ value: b.batch, label: b.batch }))} /> : null}
        {curve.length ? (
          <LineChart points={curve.map((w, i) => ({ key: `${w.day}-${i}`, label: fmtD(w.day), value: w.kg }))} format={(v) => fmtKg(v, 2)} />
        ) : (
          <Text style={{ color: color.body }}>No weighings yet for this batch.</Text>
        )}
        <View style={{ gap: space.sm }}>
          <Figure label="Age" value={batch.ageDays != null ? `${batch.ageDays} days` : "—"} />
          <Figure label="Birds alive" value={`${fmtK(batch.alive)} of ${fmtK(batch.placed)}`} />
          <Figure label="Still alive" value={`${batch.liveability.toFixed(1)}%`} tone={batch.liveability < 95 ? "warn" : undefined} />
          <Figure label="Feed for each kg gained" value={batch.fcr ? batch.fcr.toFixed(2) : "—"} />
        </View>
      </Card>
      <Card>
        <CardTitle sub="Died and culled each day, all batches">Birds lost</CardTitle>
        <BarChart tint={color.chart2} points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.lost }))} format={(v) => `${fmtK(v)} ${v === 1 ? "bird" : "birds"}`} />
      </Card>
      <Card>
        <CardTitle sub="Bags given each day, all batches">Feed</CardTitle>
        <BarChart points={rows.map((d) => ({ key: d.day, label: label(d.day), value: d.feedKg ? d.feedKg / S.feedBagKg : null }))} format={(v) => fmtBags(v * S.feedBagKg, S.feedBagKg)} />
      </Card>
    </Grid>
  );
}

/** How each part of the farm has been doing, day by day. Press a bar or a point to read it. */
export function Trends({ S }: { S: ErpData }) {
  const g = S.viewer.grants;
  const parts: Part[] = [
    ...(isFarmWide(g) && canSee(g, "money") ? (["money"] as const) : []),
    ...(["layers", "broilers", "brooding"] as const).filter((p) => canSee(g, p)),
  ];
  const [part, setPart] = useState<Part>(parts[0] ?? "layers");
  const [range, setRange] = useState(14);
  const days = lastDays(S.today, range);
  if (parts.length === 0) {
    return (
      <Card>
        <Text style={{ color: color.body, lineHeight: 22 }}>There are no trends for your part of the farm in the app yet.</Text>
      </Card>
    );
  }
  const shown = parts.includes(part) ? part : parts[0];
  return (
    <>
      {parts.length > 1 ? <Chips value={shown} onChange={setPart} options={parts.map((p) => ({ value: p, label: p === "layers" ? "Layers" : p === "money" ? "Money" : UNIT[p].label }))} /> : null}
      <Chips value={range} onChange={setRange} options={RANGES} />
      {shown === "money" ? <MoneyTrends S={S} days={days} /> : shown === "layers" ? <LayersTrends S={S} days={days} /> : <BirdsTrends key={shown} S={S} unit={shown} days={days} />}
    </>
  );
}
