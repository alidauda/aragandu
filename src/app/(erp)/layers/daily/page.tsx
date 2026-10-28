"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtBags, fmtD, fmtK, layersFeedPosition, withdrawals } from "@/lib/erp/derive";
import { Card, CardTitle, Note, PageHeader, useStackLabels } from "@/components/erp/ui";
import { DayInput } from "@/components/erp/Drawer";

const fieldInput =
  "w-full min-w-[72px] rounded-[10px] border border-[#d6dfde] bg-white px-2.5 py-2 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";
const head = "px-2 pb-1.5 text-left text-[12.5px] font-semibold text-[#738080]";

/** As typed: feed is in bags (sent as kg). */
type HouseRow = { eggs: string; cracked: string; rejects: string; feedBags: string; litres: string };
type OutRow = { died: string; culled: string };
const num = (v: string | undefined) => (v && v.trim() ? Number(v) : 0);

/**
 * Layers' whole day on one page: each house's eggs, feed and water, and
 * every batch's deaths and culls — saved together, all or nothing.
 */
export default function LayersDaily() {
  const S = useErp();
  const [day, setDay] = useState("");
  const date = day || S.today;
  const held = withdrawals(S.vaccinations, S.medications, date);
  const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);

  const [houses, setHouses] = useState<Record<string, HouseRow>>({});
  const [outs, setOuts] = useState<Record<string, OutRow>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // On phones each house (and each batch) becomes a card of labelled inputs.
  const housesTable = useStackLabels();
  const outsTable = useStackLabels();

  const setHouse = (code: string, k: keyof HouseRow, v: string) =>
    setHouses({ ...houses, [code]: { ...{ eggs: "", cracked: "", rejects: "", feedBags: "", litres: "" }, ...houses[code], [k]: v } });
  const setOut = (key: string, k: keyof OutRow, v: string) =>
    setOuts({ ...outs, [key]: { ...{ died: "", culled: "" }, ...outs[key], [k]: v } });

  // One mortality row per batch and house it's in.
  const outRows = S.batches
    .filter((b) => b.st === "active")
    .flatMap((b) =>
      b.placements.length
        ? b.placements.map((p) => ({ key: `${b.batch}|${p.house}`, batch: b.batch, house: p.house, birds: p.birds }))
        : [{ key: `${b.batch}|`, batch: b.batch, house: "", birds: b.birds - b.mortality }]
    );
  const flock = (code: string) =>
    S.batches
      .filter((b) => b.st === "active")
      .reduce((a, b) => a + (b.placements.find((p) => p.house === code)?.birds ?? 0), 0);

  const bagKg = S.feedBagKg;
  const feedTotal = Object.values(houses).reduce((a, h) => a + num(h.feedBags) * bagKg, 0);

  const save = async () => {
    const rows = S.houses.map((h) => ({ house: h.code, ...houses[h.code] }));
    for (const r of rows) {
      const vals = [r.eggs, r.cracked, r.rejects].map(num);
      if (vals.some((n) => !Number.isInteger(n) || n < 0)) {
        return setMsg({ ok: false, text: `${r.house}: eggs, cracked and rejects are whole numbers.` });
      }
      if (vals[1] + vals[2] > vals[0]) {
        return setMsg({ ok: false, text: `${r.house}: cracked + rejects can't exceed eggs collected.` });
      }
      if (num(r.feedBags) < 0 || num(r.litres) < 0) return setMsg({ ok: false, text: `${r.house}: feed and water can't be negative.` });
    }
    for (const o of outRows) {
      const v = outs[o.key];
      const died = num(v?.died);
      const culled = num(v?.culled);
      if (![died, culled].every((n) => Number.isInteger(n) && n >= 0)) {
        return setMsg({ ok: false, text: `${o.batch}: birds are whole numbers.` });
      }
      if (died + culled > o.birds) {
        return setMsg({ ok: false, text: `${o.batch}${o.house ? ` in ${o.house}` : ""} only has ${fmtK(o.birds)} birds.` });
      }
    }
    if (feedTotal > Math.max(0, feed.stockKg) + 1e-9) {
      return setMsg({ ok: false, text: `Only ${fmtBags(Math.max(0, feed.stockKg), bagKg)} of feed on hand.` });
    }
    const housesIn = rows
      .map((r) => ({
        house: r.house,
        eggs: num(r.eggs),
        cracked: num(r.cracked),
        rejects: num(r.rejects),
        feedKg: num(r.feedBags) * bagKg,
        litres: num(r.litres),
      }))
      .filter((r) => r.eggs || r.cracked || r.rejects || r.feedKg || r.litres);
    const birdsOut = outRows
      .map((o) => ({ batch: o.batch, house: o.house || undefined, died: num(outs[o.key]?.died), culled: num(outs[o.key]?.culled) }))
      .filter((o) => o.died || o.culled);
    if (!housesIn.length && !birdsOut.length) return setMsg({ ok: false, text: "Fill in at least one figure." });
    setMsg(null);
    const r = await S.addDailyRecords({ houses: housesIn, birdsOut, date: day || undefined });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setHouses({});
    setOuts({});
    setMsg({ ok: true, text: `Saved ${date === S.today ? "today's" : `${fmtD(date)}'s`} records ✓` });
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Daily entry"
        sub="The whole day in one go — eggs, feed and water per house, and birds out"
      />

      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
        <label className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-[#465657]">Day</span>
          <DayInput value={day} onChange={setDay} className={`${fieldInput} w-auto`} />
        </label>
        {date !== S.today ? (
          <span className="text-[13px] font-semibold text-[#9a6a12]">Recording for {fmtD(date)}, not today</span>
        ) : null}
        <span className="ml-auto text-[13px] text-[#465657]">
          Feed on hand: <span className="font-semibold">{fmtBags(Math.max(0, feed.stockKg), bagKg)}</span>
          {feed.daysCover ? <span className="text-[#84908f]"> · about {feed.daysCover} days</span> : null}
        </span>
      </Card>

      {held.size ? (
        <div className="mb-4 rounded-2xl border border-[#f0cfc9] bg-[#fbeae7] px-4 py-3 text-[14px] text-[#8a2f22]">
          Drug withdrawal on {fmtD(date)}: {[...held].map(([h]) => h).join(", ")} — good eggs from{" "}
          {held.size > 1 ? "these houses" : "this house"} are recorded as withheld.
        </div>
      ) : null}

      <Card className="mb-4 overflow-x-auto px-4 py-4">
        <CardTitle>Houses</CardTitle>
        <table ref={housesTable} className="stack-table mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={head}>House</th>
              <th className={head}>Eggs collected</th>
              <th className={head}>Cracked</th>
              <th className={head}>Rejects</th>
              <th className={head}>Feed used (bags)</th>
              <th className={head}>Water (litres)</th>
            </tr>
          </thead>
          <tbody>
            {S.houses.map((h) => {
              const v = houses[h.code];
              return (
                <tr key={h.code} className="border-t border-[#ebf0ef]">
                  <td className="px-2 py-2">
                    <div className="font-semibold">{h.code}</div>
                    <div className="text-[12px] text-[#84908f]">{fmtK(flock(h.code))} birds</div>
                  </td>
                  {(["eggs", "cracked", "rejects", "feedBags", "litres"] as const).map((k) => (
                    <td key={k} className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step={k === "feedBags" ? "0.5" : undefined}
                        value={v?.[k] ?? ""}
                        onChange={(e) => setHouse(h.code, k, e.target.value)}
                        placeholder="0"
                        className={fieldInput}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="mb-4 overflow-x-auto px-4 py-4">
        <CardTitle>Birds out (mortality)</CardTitle>
        {outRows.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-[#84908f]">No active batches.</p>
        ) : (
          <table ref={outsTable} className="stack-table mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={head}>Batch</th>
                <th className={head}>House</th>
                <th className={head}>Birds there</th>
                <th className={head}>Died</th>
                <th className={head}>Culled</th>
              </tr>
            </thead>
            <tbody>
              {outRows.map((o) => (
                <tr key={o.key} className="border-t border-[#ebf0ef]">
                  <td className="px-2 py-2 font-semibold">{o.batch}</td>
                  <td className="px-2 py-2">{o.house || "—"}</td>
                  <td className="px-2 py-2 font-data text-[#5d6b6b]">{fmtK(o.birds)}</td>
                  {(["died", "culled"] as const).map((k) => (
                    <td key={k} className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={outs[o.key]?.[k] ?? ""}
                        onChange={(e) => setOut(o.key, k, e.target.value)}
                        placeholder="0"
                        className={fieldInput}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={S.saving}
          className="font-sub rounded-[10px] bg-[#055a5b] px-6 py-3 text-[15px] text-white transition-colors hover:bg-[#044647] disabled:opacity-50"
        >
          {S.saving ? "Saving…" : date === S.today ? "Save today's records" : `Save records for ${fmtD(date)}`}
        </button>
        {msg ? (
          <span className={`text-[13.5px] font-semibold ${msg.ok ? "text-[#016559]" : "text-[#c7402f]"}`}>{msg.text}</span>
        ) : null}
      </div>

      <Note>
        Leave anything you didn&apos;t record empty. Everything on the page saves together — if one figure is
        refused (say, more feed than is in store), nothing is saved and the message says why. Each line still
        shows on its own page (Production, Feed, Water, Mortality), where an admin can delete a wrong one.
      </Note>
    </>
  );
}
