import { useState } from "react";

import { addDays, feedByType, fmtBags, fmtEggs, fmtK, layersFeedPosition, millFeed } from "@farm/erp/derive";
import type { ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure } from "@/components/card";
import { Chips } from "@/components/chips";
import { DayChips } from "@/components/day-chips";
import { Field, FieldRow } from "@/components/field";
import { Notice } from "@/components/notice";
import { dayName, farmDay, num } from "@/farm/day";
import { feedChoices } from "@/farm/feed";
import { useFarm } from "@/farm/store";
import { useSend } from "@/hooks/use-send";
import { color, font } from "@/theme";
import { Text } from "@/components/text";

/** A line as typed: eggs in crates and loose pieces, feed in bags. */
type Line = { crates: string; pieces: string; rejects: string; feedType: number; feedBags: string; died: string; culled: string; litres: string };
const blank: Line = { crates: "", pieces: "", rejects: "", feedType: 0, feedBags: "", died: "", culled: "", litres: "" };

/**
 * Layers' whole day: one card for each flock in each house. It all saves
 * together, or none of it does — the same entry as the website's Daily entry.
 */
export function LayersDaily({ S }: { S: ErpData }) {
  const { online } = useFarm();
  const today = farmDay();
  const [day, setDay] = useState(today);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const { busy, message, send, problem } = useSend();
  const bagKg = S.feedBagKg;
  const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);

  // One line per flock and house it's in. A flock not placed yet can only lose birds.
  const rows = S.batches
    .filter((b) => b.st === "active")
    .flatMap((b) =>
      b.placements.length
        ? b.placements.map((p) => ({ key: `${b.batch}|${p.house}`, batch: b.batch, house: p.house, birds: p.birds }))
        : [{ key: `${b.batch}|`, batch: b.batch, house: "", birds: b.birds - b.mortality }]
    );
  const set = <F extends keyof Line>(key: string, field: F, v: Line[F]) => setLines({ ...lines, [key]: { ...blank, ...lines[key], [field]: v } });
  const types = feedChoices(S.products, feedByType(S.products, [...S.layersFeedDeliveries, ...millFeed(S.feedSales, S.products, "layers")], S.feedUse), bagKg);
  // Each line's feed type: what the flock last ate if there's still some, else the type there's most of — until changed.
  const typeOf = (r: { key: string; batch: string }) => {
    const last = S.feedUse.find((u) => u.batch === r.batch && u.product)?.product;
    return lines[r.key]?.feedType || (types.some((t) => t.value === last) ? last : types[0]?.value) || 0;
  };
  // What each line had the day before, as a guide while typing.
  const before = (r: { batch: string; house: string }) => {
    const prev = addDays(day, -1);
    const eggs = S.prodLog.filter((p) => p.date === prev && p.batch === r.batch && p.house === r.house).reduce((a, p) => a + p.eggs, 0);
    const kg = S.feedUse.filter((u) => u.date === prev && u.batch === r.batch && u.house === r.house).reduce((a, u) => a + u.kg, 0);
    const parts = [eggs ? fmtEggs(eggs, S.eggsPerCrate) : null, kg ? `${fmtBags(kg, bagKg)} feed` : null].filter(Boolean);
    return parts.length ? `The day before: ${parts.join(" · ")}` : "";
  };
  const eggsOf = (l?: Line) => num(l?.crates) * S.eggsPerCrate + num(l?.pieces);
  const totalEggs = rows.reduce((a, r) => a + eggsOf(lines[r.key]), 0);
  const totalKg = rows.reduce((a, r) => a + num(lines[r.key]?.feedBags) * bagKg, 0);
  const totalLost = rows.reduce((a, r) => a + num(lines[r.key]?.died) + num(lines[r.key]?.culled), 0);

  const save = () => {
    for (const r of rows) {
      const l = lines[r.key];
      const where = `${r.batch}${r.house ? ` in ${r.house}` : ""}`;
      const all = [l?.crates, l?.pieces, l?.rejects, l?.died, l?.culled, l?.feedBags, l?.litres].map(num);
      if (all.some((n) => !Number.isFinite(n) || n < 0)) return problem(`${where}: enter numbers only.`);
      if (all.slice(0, 5).some((n) => !Number.isInteger(n))) return problem(`${where}: crates, pieces, rejects, mortality and culls are whole numbers.`);
      if (num(l?.rejects) > eggsOf(l)) return problem(`${where}: rejects can't exceed eggs collected.`);
      if (num(l?.died) + num(l?.culled) > r.birds) return problem(`${where} only has ${fmtK(r.birds)} birds.`);
    }
    // With no signal the feed figure may be old, so the website decides when the entry arrives.
    if (online && totalKg > Math.max(0, feed.stockKg) + 1e-9) return problem(`Only ${fmtBags(Math.max(0, feed.stockKg), bagKg)} of feed on hand.`);
    const filled = rows
      .map((r) => {
        const l = lines[r.key];
        return {
          batch: r.batch,
          house: r.house,
          eggs: eggsOf(l),
          rejects: num(l?.rejects),
          feedKg: num(l?.feedBags) * bagKg,
          feedProduct: num(l?.feedBags) ? typeOf(r) || undefined : undefined,
          litres: num(l?.litres),
          died: num(l?.died),
          culled: num(l?.culled),
        };
      })
      .filter((l) => l.eggs || l.rejects || l.feedKg || l.litres || l.died || l.culled);
    if (filled.length === 0) return problem("Fill in at least one figure.");
    const detail = [
      dayName(day, today),
      `${filled.length} ${filled.length === 1 ? "line" : "lines"}`,
      totalEggs ? fmtEggs(totalEggs, S.eggsPerCrate) : null,
      totalKg ? `${fmtBags(totalKg, bagKg)} feed` : null,
      totalLost ? `${totalLost} ${totalLost === 1 ? "bird" : "birds"} lost` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    void send("addDailyRecords", { rows: filled, date: day }, { title: "Layers daily records", detail }, () => setLines({}));
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>No flocks on the farm</CardTitle>
        <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>Add a flock on the website (Layers → Flocks), then pull down to reload.</Text>
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

      {rows.map((r) => {
        const l = lines[r.key] ?? blank;
        return (
          <Card key={r.key}>
            <CardTitle sub={`${fmtK(r.birds)} birds`}>{r.house ? `${r.batch} · ${r.house}` : `${r.batch} · not in a house yet`}</CardTitle>
            {r.house && before(r) ? <Text style={{ fontSize: font.small, color: color.muted, marginTop: -6 }}>{before(r)}</Text> : null}
            {r.house ? (
              <>
                <FieldRow>
                  <Field label="Crates" value={l.crates} onChange={(v) => set(r.key, "crates", v)} />
                  <Field label="Pieces" value={l.pieces} onChange={(v) => set(r.key, "pieces", v)} />
                  <Field label="Rejects" value={l.rejects} onChange={(v) => set(r.key, "rejects", v)} />
                </FieldRow>
                <FieldRow>
                  <Field label="Feed (bags)" kind="decimal" value={l.feedBags} onChange={(v) => set(r.key, "feedBags", v)} />
                  <Field label="Water (litres)" kind="decimal" value={l.litres} onChange={(v) => set(r.key, "litres", v)} />
                </FieldRow>
                {num(l.feedBags) > 0 && types.length > 1 ? <Chips label="Feed type" value={typeOf(r)} onChange={(v) => set(r.key, "feedType", v)} options={types} /> : null}
              </>
            ) : null}
            <FieldRow>
              <Field label="Mortality" value={l.died} onChange={(v) => set(r.key, "died", v)} />
              <Field label="Culls" value={l.culled} onChange={(v) => set(r.key, "culled", v)} />
            </FieldRow>
          </Card>
        );
      })}

      <Card>
        <Figure label="Eggs" value={fmtEggs(totalEggs, S.eggsPerCrate)} />
        <Figure label="Feed" value={fmtBags(totalKg, bagKg)} />
        <Figure label="Birds lost" value={fmtK(totalLost)} />
      </Card>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label={`Save ${day === today ? "today's" : `${dayName(day, today)}'s`} records`} onPress={save} busy={busy} />
    </>
  );
}
