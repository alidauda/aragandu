import { useState } from "react";

import { broilerFeedPosition, broilersAlive, UNIT } from "@farm/erp/broilers";
import { feedByType, fmtBags, fmtK, millFeed } from "@farm/erp/derive";
import type { BirdUnit, ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure } from "@/components/card";
import { Chips } from "@/components/chips";
import { DayChips } from "@/components/day-chips";
import { Field, FieldRow } from "@/components/field";
import { Grid } from "@/components/grid";
import { Notice } from "@/components/notice";
import { dayName, farmDay, num } from "@/farm/day";
import { feedChoices } from "@/farm/feed";
import { useFarm } from "@/farm/store";
import { unitView } from "@/farm/unit";
import { useSend } from "@/hooks/use-send";
import { color, font } from "@/theme";
import { Text } from "@/components/text";

type Line = { feedType: number; feedBags: string; litres: string; died: string; culled: string; weighBirds: string; weighKg: string };
const blank: Line = { feedType: 0, feedBags: "", litres: "", died: "", culled: "", weighBirds: "", weighKg: "" };

/** Broilers' or Brooding's whole day: one card per batch, saved together. */
export function BirdsDaily({ S: all, unit }: { S: ErpData; unit: BirdUnit }) {
  const { online } = useFarm();
  const S = unitView(all, unit);
  const today = farmDay();
  const [day, setDay] = useState(today);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const { busy, message, send, problem } = useSend();
  const bagKg = S.feedBagKg;
  const feed = broilerFeedPosition(S, S.today, unit);
  const name = UNIT[unit].label;

  const rows = S.broilerBatches.filter((b) => b.st === "active").map((b) => ({ batch: b.batch, house: b.house, alive: broilersAlive(b, S) }));
  const set = <F extends keyof Line>(batch: string, field: F, v: Line[F]) => setLines({ ...lines, [batch]: { ...blank, ...lines[batch], [field]: v } });
  const types = feedChoices(
    S.products,
    feedByType(S.products, [...S.broilerFeedDeliveries, ...millFeed(S.feedSales, S.products, unit)], S.broilerDaily.map((r) => ({ product: r.product, kg: r.feedKg }))),
    bagKg
  );
  // Each line's feed type: what the batch last ate if there's still some, else the type there's most of — until changed.
  const typeOf = (batch: string) => {
    const last = S.broilerDaily.find((x) => x.batch === batch && x.product)?.product;
    return lines[batch]?.feedType || (types.some((t) => t.value === last) ? last : types[0]?.value) || 0;
  };
  const totalKg = rows.reduce((a, r) => a + num(lines[r.batch]?.feedBags) * bagKg, 0);
  const totalLost = rows.reduce((a, r) => a + num(lines[r.batch]?.died) + num(lines[r.batch]?.culled), 0);

  const save = () => {
    for (const r of rows) {
      const l = lines[r.batch];
      const all = [l?.died, l?.culled, l?.weighBirds, l?.feedBags, l?.litres, l?.weighKg].map(num);
      if (all.some((n) => !Number.isFinite(n) || n < 0)) return problem(`${r.batch}: enter numbers only.`);
      if (all.slice(0, 3).some((n) => !Number.isInteger(n))) return problem(`${r.batch}: mortality, culls and birds weighed are whole numbers.`);
      if (num(l?.died) + num(l?.culled) > r.alive) return problem(`${r.batch} only has ${fmtK(r.alive)} birds.`);
      if (!num(l?.weighBirds) !== !num(l?.weighKg)) return problem(`${r.batch}: enter both the birds weighed and their weight.`);
    }
    // With no signal the feed figure may be old, so the website decides when the entry arrives.
    if (online && totalKg > Math.max(0, feed.stockKg) + 1e-9) return problem(`Only ${fmtBags(Math.max(0, feed.stockKg), bagKg)} of feed on hand.`);
    const filled = rows
      .map((r) => {
        const l = lines[r.batch];
        return {
          batch: r.batch,
          feedKg: num(l?.feedBags) * bagKg,
          feedProduct: num(l?.feedBags) ? typeOf(r.batch) || undefined : undefined,
          litres: num(l?.litres),
          died: num(l?.died),
          culled: num(l?.culled),
          weighBirds: num(l?.weighBirds),
          weighKg: num(l?.weighKg),
        };
      })
      .filter((l) => l.feedKg || l.litres || l.died || l.culled || l.weighBirds);
    if (filled.length === 0) return problem("Fill in at least one figure.");
    const detail = [
      dayName(day, today),
      `${filled.length} ${filled.length === 1 ? "batch" : "batches"}`,
      totalKg ? `${fmtBags(totalKg, bagKg)} feed` : null,
      totalLost ? `${totalLost} ${totalLost === 1 ? "bird" : "birds"} lost` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    void send("addBroilerDaily", { rows: filled, date: day }, { title: `${name} daily records`, detail }, () => setLines({}));
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>No batches growing</CardTitle>
        <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>{`Add a batch on the website (${name} → Batches), then pull down to reload.`}</Text>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <DayChips today={today} value={day} onChange={setDay} />
        {day !== today ? <Notice tone="warn">{`Recording for ${dayName(day, today)}, not today.`}</Notice> : null}
        <Figure
          label="Feed on hand"
          value={`${fmtBags(Math.max(0, feed.stockKg), bagKg)}${feed.daysCover ? ` · about ${feed.daysCover} days` : ""}`}
          tone={feed.daysCover && feed.daysCover < 7 ? "warn" : undefined}
        />
      </Card>

      <Grid>
      {rows.map((r) => {
        const l = lines[r.batch] ?? blank;
        return (
          <Card key={r.batch}>
            <CardTitle sub={`${fmtK(r.alive)} birds`}>{r.house ? `${r.batch} · ${r.house}` : r.batch}</CardTitle>
            <FieldRow>
              <Field label="Feed (bags)" kind="decimal" value={l.feedBags} onChange={(v) => set(r.batch, "feedBags", v)} />
              <Field label="Water (litres)" kind="decimal" value={l.litres} onChange={(v) => set(r.batch, "litres", v)} />
            </FieldRow>
            {num(l.feedBags) > 0 && types.length > 1 ? <Chips label="Feed type" value={typeOf(r.batch)} onChange={(v) => set(r.batch, "feedType", v)} options={types} /> : null}
            <FieldRow>
              <Field label="Mortality" value={l.died} onChange={(v) => set(r.batch, "died", v)} />
              <Field label="Culls" value={l.culled} onChange={(v) => set(r.batch, "culled", v)} />
            </FieldRow>
            <FieldRow>
              <Field label="Birds weighed" value={l.weighBirds} onChange={(v) => set(r.batch, "weighBirds", v)} />
              <Field label="Their weight (kg)" kind="decimal" value={l.weighKg} onChange={(v) => set(r.batch, "weighKg", v)} />
            </FieldRow>
          </Card>
        );
      })}
      </Grid>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label={`Save ${day === today ? "today's" : `${dayName(day, today)}'s`} records`} onPress={save} busy={busy} />
    </>
  );
}
