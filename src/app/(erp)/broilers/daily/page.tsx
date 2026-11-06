"use client";

import { Fragment, useState } from "react";

import { broilerFeedPosition, broilersAlive } from "@/lib/erp/broilers";
import { fmtBags, fmtD, fmtK } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, DeleteButton, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged, useStackLabels } from "@/components/erp/ui";
import { DayInput } from "@/components/erp/Drawer";
import { feedTypeName } from "@/components/erp/FeedTypes";

const fieldInput =
  "w-full min-w-[72px] rounded-[10px] border border-[#d6dfde] bg-white px-2.5 py-2 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";
const head = "px-2 pb-1.5 text-left text-[12.5px] font-semibold text-[#738080]";

type Line = { feedType: string; feedBags: string; litres: string; died: string; culled: string; weighBirds: string; weighKg: string };
const FIELDS: { key: keyof Line; label: string; step?: string }[] = [
  { key: "feedBags", label: "Feed (bags)", step: "0.5" },
  { key: "litres", label: "Water (litres)" },
  { key: "died", label: "Mortality" },
  { key: "culled", label: "Culls" },
  { key: "weighBirds", label: "Birds weighed" },
  { key: "weighKg", label: "Their weight (kg)", step: "0.01" },
];
const blank: Line = { feedType: "", feedBags: "", litres: "", died: "", culled: "", weighBirds: "", weighKg: "" };
const typeSelect = "w-full min-w-[120px] rounded-[10px] border border-[#d6dfde] bg-white px-2 py-2 text-[14px] outline-none focus:border-[#055a5b] disabled:bg-[#f4f6f5]";
const num = (v: string | undefined) => (v && v.trim() ? Number(v) : 0);

/** The broilers' whole day on one page, one line per batch; it all saves together. */
export default function BroilersDaily() {
  const S = useErp();
  const [day, setDay] = useState("");
  const date = day || S.today;
  const bagKg = S.feedBagKg;
  const feed = broilerFeedPosition(S, S.today);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const table = useStackLabels();

  const rows = S.broilerBatches
    .filter((b) => b.st === "active")
    .map((b) => ({ batch: b.batch, house: b.house, alive: broilersAlive(b, S) }));
  const paged = usePaged(rows);
  const log = usePaged(S.broilerDaily);
  const set = (batch: string, k: keyof Line, v: string) => setLines({ ...lines, [batch]: { ...blank, ...lines[batch], [k]: v } });
  // Each line's feed type: what the batch last ate, until changed.
  const typeOf = (batch: string) =>
    Number(lines[batch]?.feedType || S.broilerDaily.find((x) => x.batch === batch && x.product)?.product || S.products[0]?.id || 0);
  const totalKg = rows.reduce((a, r) => a + num(lines[r.batch]?.feedBags) * bagKg, 0);

  const save = async () => {
    for (const r of rows) {
      const l = lines[r.batch];
      if ([l?.died, l?.culled, l?.weighBirds].map(num).some((n) => !Number.isInteger(n) || n < 0)) {
        return setMsg({ ok: false, text: `${r.batch}: mortality, culls and birds weighed are whole numbers.` });
      }
      if ([l?.feedBags, l?.litres, l?.weighKg].map(num).some((n) => n < 0)) {
        return setMsg({ ok: false, text: `${r.batch}: figures can't be negative.` });
      }
      if (num(l?.died) + num(l?.culled) > r.alive) return setMsg({ ok: false, text: `${r.batch} only has ${fmtK(r.alive)} birds.` });
      if (!num(l?.weighBirds) !== !num(l?.weighKg)) {
        return setMsg({ ok: false, text: `${r.batch}: enter both the birds weighed and their weight.` });
      }
    }
    if (totalKg > Math.max(0, feed.stockKg) + 1e-9) {
      return setMsg({ ok: false, text: `Only ${fmtBags(Math.max(0, feed.stockKg), bagKg)} of broiler feed on hand.` });
    }
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
    if (filled.length === 0) return setMsg({ ok: false, text: "Fill in at least one figure." });
    setMsg(null);
    const r = await S.addBroilerDaily({ rows: filled, date: day || undefined });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setLines({});
    setMsg({ ok: true, text: `Saved ${date === S.today ? "today's" : `${fmtD(date)}'s`} records ✓` });
  };

  return (
    <>
      <PageHeader eyebrow="Broilers" title="Daily entry" sub="The whole day in one go — one line for each batch" />

      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
        <label className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-[#465657]">Day</span>
          <DayInput value={day} onChange={setDay} className={`${fieldInput} w-auto`} />
        </label>
        {date !== S.today ? <span className="text-[13px] font-semibold text-[#9a6a12]">Recording for {fmtD(date)}, not today</span> : null}
        <span className="ml-auto text-[13px] text-[#465657]">
          Feed on hand: <span className="font-semibold">{fmtBags(Math.max(0, feed.stockKg), bagKg)}</span>
          {feed.daysCover ? <span className="text-[#84908f]"> · about {feed.daysCover} days</span> : null}
        </span>
      </Card>

      <Card className="mb-4 overflow-x-auto py-4">
        {rows.length === 0 ? (
          <p className="px-4 text-[13.5px] text-[#84908f]">No batches growing. Add one on Batches.</p>
        ) : (
          <div className="px-4">
            <table ref={table} className="stack-table w-full border-collapse">
              <thead>
                <tr>
                  <th className={head}>Batch</th>
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
                  <tr key={r.batch} className="border-t border-[#ebf0ef]">
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="font-semibold">{r.batch}</div>
                      <div className="text-[12px] text-[#84908f]">
                        {r.house ?? "no house"} · {fmtK(r.alive)} birds
                      </div>
                    </td>
                    {FIELDS.map((f) => (
                      <Fragment key={f.key}>
                      {f.key === "feedBags" ? (
                        <td className="px-2 py-2">
                          <select
                            aria-label={`${r.batch} Feed type`}
                            value={String(typeOf(r.batch))}
                            onChange={(e) => set(r.batch, "feedType", e.target.value)}
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
                          aria-label={`${r.batch} ${f.label}`}
                          value={lines[r.batch]?.[f.key] ?? ""}
                          onChange={(e) => set(r.batch, f.key, e.target.value)}
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
          </div>
        )}
        {paged.pager}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={S.saving}
          className="font-sub rounded-[10px] bg-[#055a5b] px-6 py-3 text-[15px] text-white transition-colors hover:bg-[#044647] disabled:opacity-50"
        >
          {S.saving ? "Saving…" : date === S.today ? "Save today's records" : `Save records for ${fmtD(date)}`}
        </button>
        {msg ? <span className={`text-[13.5px] font-semibold ${msg.ok ? "text-[#016559]" : "text-[#c7402f]"}`}>{msg.text}</span> : null}
      </div>

      <Card className="mt-5 overflow-hidden">
        <Table pager={log.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Batch</Th>
            <Th right>Feed</Th>
            <Th>Feed type</Th>
            <Th right>Water</Th>
            <Th right>Mortality</Th>
            <Th right>Culls</Th>
            <Th right />
          </THead>
          <tbody>
            {S.broilerDaily.length === 0 ? (
              <TRow>
                <Td colSpan={8} className="text-[#84908f]">
                  No daily records yet.
                </Td>
              </TRow>
            ) : null}
            {log.rows.map((r) => (
              <TRow key={r.id}>
                <Td>
                  {fmtD(r.date)}
                  <Recorded at={r.createdAt} date={r.date} />
                </Td>
                <Td className="font-semibold">{r.batch}</Td>
                <Td right>{r.feedKg ? fmtBags(r.feedKg, bagKg) : "—"}</Td>
                <Td>{r.feedKg ? feedTypeName(S.products, r.product) : "—"}</Td>
                <Td right>{r.litres ? `${fmtK(r.litres)} L` : "—"}</Td>
                <Td right>{r.died || "—"}</Td>
                <Td right>{r.culled || "—"}</Td>
                <Td right>
                  <DeleteButton kind="broilerDaily" id={r.id} what={`the ${fmtD(r.date)} ${r.batch} record`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Weigh a sample of birds together (say 50) and enter how many and their total weight; the average is worked out
        for you, and shows on Weighing. Everything saves together — if one figure is refused, nothing is saved and the
        message says why.
      </Note>
    </>
  );
}
