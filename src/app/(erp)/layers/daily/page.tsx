"use client";

import { Fragment, useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtBags, fmtD, fmtEggs, fmtK, layersFeedPosition, withdrawals } from "@/lib/erp/derive";
import { Entry, Card, Note, PageHeader, usePaged, useStackLabels } from "@/components/erp/ui";
import { DayInput } from "@/components/erp/Drawer";

const fieldInput =
  "w-full min-w-[72px] rounded-[10px] border border-[#d6dfde] bg-white px-2.5 py-2 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15 disabled:bg-[#f4f6f5]";
const head = "px-2 pb-1.5 text-left text-[12.5px] font-semibold text-[#738080]";

/** A line as typed: feed in bags, eggs in crates and loose pieces. */
type Line = { crates: string; pieces: string; rejects: string; feedType: string; feedBags: string; died: string; culled: string; litres: string };
const FIELDS: { key: keyof Line; label: string; step?: string; housed?: boolean }[] = [
  { key: "crates", label: "Crates", housed: true },
  { key: "pieces", label: "Pieces", housed: true },
  { key: "rejects", label: "Rejects", housed: true },
  { key: "feedBags", label: "Feed intake (bags)", step: "0.5", housed: true },
  { key: "died", label: "Mortality" },
  { key: "culled", label: "Culls" },
  { key: "litres", label: "Water (litres)", housed: true },
];
const blank: Line = { crates: "", pieces: "", rejects: "", feedType: "", feedBags: "", died: "", culled: "", litres: "" };
const typeSelect = "w-full min-w-[120px] rounded-[10px] border border-[#d6dfde] bg-white px-2 py-2 text-[14px] outline-none focus:border-[#055a5b] disabled:bg-[#f4f6f5]";
const num = (v: string | undefined) => (v && v.trim() ? Number(v) : 0);

/**
 * Layers' whole day on one page, one line per flock in each house, so
 * every flock can be followed on its own, not just the pen. It all saves
 * together, or none of it does.
 */
export default function LayersDaily() {
  const S = useErp();
  const [day, setDay] = useState("");
  const date = day || S.today;
  const held = withdrawals(S.vaccinations, S.medications, date);
  const feed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);
  const bagKg = S.feedBagKg;

  const [lines, setLines] = useState<Record<string, Line>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // On phones each line becomes a card of labelled inputs.
  const table = useStackLabels();

  // One line per flock and house it's in. A flock not placed yet can only lose birds.
  const rows = S.batches
    .filter((b) => b.st === "active")
    .flatMap((b) =>
      b.placements.length
        ? b.placements.map((p) => ({ key: `${b.batch}|${p.house}`, batch: b.batch, house: p.house, birds: p.birds }))
        : [{ key: `${b.batch}|`, batch: b.batch, house: "", birds: b.birds - b.mortality }]
    );
  const set = (key: string, k: keyof Line, v: string) =>
    setLines({ ...lines, [key]: { ...blank, ...lines[key], [k]: v } });
  // Each line's feed type: what the flock last ate, until changed.
  const typeOf = (r: { key: string; batch: string }) =>
    Number(lines[r.key]?.feedType || S.feedUse.find((u) => u.batch === r.batch && u.product)?.product || S.products[0]?.id || 0);
  const eggsOf = (l?: Line) => num(l?.crates) * S.eggsPerCrate + num(l?.pieces);
  const emptyHouses = S.houses.filter((h) => !rows.some((r) => r.house === h.code)).length;

  const totals = rows.reduce(
    (a, r) => {
      const l = lines[r.key];
      return {
        eggs: a.eggs + eggsOf(l),
        kg: a.kg + num(l?.feedBags) * bagKg,
        died: a.died + num(l?.died),
        culled: a.culled + num(l?.culled),
        litres: a.litres + num(l?.litres),
      };
    },
    { eggs: 0, kg: 0, died: 0, culled: 0, litres: 0 }
  );

  const paged = usePaged(rows);

  const save = async () => {
    for (const r of rows) {
      const l = lines[r.key];
      const where = `${r.batch}${r.house ? ` in ${r.house}` : ""}`;
      const whole = [l?.crates, l?.pieces, l?.rejects, l?.died, l?.culled].map(num);
      if (whole.some((n) => !Number.isInteger(n) || n < 0)) {
        return setMsg({ ok: false, text: `${where}: crates, pieces, rejects, mortality and culls are whole numbers.` });
      }
      if (num(l?.rejects) > eggsOf(l)) return setMsg({ ok: false, text: `${where}: rejects can't exceed eggs collected.` });
      if (num(l?.feedBags) < 0 || num(l?.litres) < 0) {
        return setMsg({ ok: false, text: `${where}: feed and water can't be negative.` });
      }
      if (num(l?.died) + num(l?.culled) > r.birds) {
        return setMsg({ ok: false, text: `${where} only has ${fmtK(r.birds)} birds.` });
      }
    }
    if (totals.kg > Math.max(0, feed.stockKg) + 1e-9) {
      return setMsg({ ok: false, text: `Only ${fmtBags(Math.max(0, feed.stockKg), bagKg)} of feed on hand.` });
    }
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
    if (filled.length === 0) return setMsg({ ok: false, text: "Fill in at least one figure." });
    setMsg(null);
    const r = await S.addDailyRecords({ rows: filled, date: day || undefined });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setLines({});
    setMsg({ ok: true, text: `Saved ${date === S.today ? "today's" : `${fmtD(date)}'s`} records ✓` });
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Daily entry"
        sub="The whole day in one go — one line for each flock in each house"
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

      <Entry>
        <Card className="mb-4 overflow-x-auto px-4 py-4">
          {rows.length === 0 ? (
            <p className="text-[13.5px] text-[#84908f]">No active flocks. Add one on Batches.</p>
          ) : (
            <table ref={table} className="stack-table w-full border-collapse">
              <thead>
                <tr>
                  <th className={head}>Flock</th>
                  {FIELDS.map((f) => (
                    <Fragment key={f.key}>
                      {f.key === "feedBags" ? <th className={head}>Feed type</th> : null}
                      <th className={head}>{f.label}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((r) => (
                  <tr key={r.key} className="border-t border-[#ebf0ef]">
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="font-semibold">{r.batch}</div>
                      <div className="text-[12px] text-[#84908f]">
                        {r.house || "not in a house"} · {fmtK(r.birds)} birds
                      </div>
                    </td>
                    {FIELDS.map((f) => (
                      <Fragment key={f.key}>
                      {f.key === "feedBags" ? (
                        <td className="px-2 py-2">
                          <select
                            aria-label={`${r.batch} ${r.house} Feed type`}
                            disabled={!r.house}
                            value={String(typeOf(r))}
                            onChange={(e) => set(r.key, "feedType", e.target.value)}
                            className={typeSelect}
                          >
                            {S.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={f.step}
                          disabled={f.housed && !r.house}
                          aria-label={`${r.batch} ${r.house} ${f.label}`}
                          value={lines[r.key]?.[f.key] ?? ""}
                          onChange={(e) => set(r.key, f.key, e.target.value)}
                          placeholder="0"
                          className={fieldInput}
                        />
                      </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {paged.pager}
        </Card>

        {totals.eggs || totals.kg || totals.died || totals.culled || totals.litres ? (
          <p className="mb-3 text-[13.5px] text-[#465657]">
            Day&apos;s total: <span className="font-semibold">{fmtEggs(totals.eggs, S.eggsPerCrate)}</span> ·{" "}
            <span className="font-semibold">{fmtBags(totals.kg, bagKg)}</span> of feed ·{" "}
            <span className="font-semibold">{totals.died}</span> died · <span className="font-semibold">{totals.culled}</span>{" "}
            culled · <span className="font-semibold">{fmtK(totals.litres)} L</span> water
          </p>
        ) : null}

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
      </Entry>

      <Note>
        Each line is saved against its flock, so flocks can be compared on Flock analysis. Leave anything you didn&apos;t
        record empty. Everything saves together — if one figure is refused (say, more feed than is in store), nothing is
        saved and the message says why. Each entry still shows on its own page, where an admin can delete a wrong one.
        {emptyHouses ? ` ${emptyHouses} house${emptyHouses === 1 ? " has" : "s have"} no birds, so ${emptyHouses === 1 ? "isn't" : "aren't"} listed.` : ""}
      </Note>
    </>
  );
}
