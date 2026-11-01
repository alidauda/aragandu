"use client";

import { Fragment, useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { useErp } from "@/lib/erp/store";
import { addDays, flockStats, fmtBags, fmtD, fmtEggs, fmtK } from "@/lib/erp/derive";
import { Badge, Card, Note, PageHeader, Table, Td, Th, THead, TRow } from "@/components/erp/ui";

const input = "rounded-lg border border-[#d6dfde] bg-white px-2.5 py-1.5 text-[13px]";

/** Compares flocks over a period: eggs, feed, water and birds out — not just pens. */
export default function FlockAnalysis() {
  const S = useErp();
  const monthStart = S.today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(S.today);
  const earliest = [...S.prodLog, ...S.feedUse, ...S.waterLogs, ...S.birdOuts].reduce(
    (a, r) => (r.date < a ? r.date : a),
    S.today
  );
  const presets: [string, string][] = [
    ["This month", monthStart],
    ["Last 7 days", addDays(S.today, -6)],
    ["Last 30 days", addDays(S.today, -29)],
    ["All time", earliest],
  ];
  const { flocks, unlinked, totalEggs, overallPct } = flockStats(S, from, to);

  const per = S.eggsPerCrate;
  const percent = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);
  const share = (eggs: number) => (totalEggs ? `${((100 * eggs) / totalEggs).toFixed(1)}%` : "—");
  const sum = (f: (x: (typeof flocks)[number]) => number) => flocks.reduce((a, x) => a + f(x), 0);
  const gramsPerBird = (kg: number, days: number, birds: number) =>
    days && birds ? `${Math.round((kg * 1000) / days / birds)} g` : "—";
  const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(2)}%` : "—");

  const exportCsv = () =>
    downloadCsv(
      `argandu-flocks-${from}-to-${to}.csv`,
      flocks.flatMap((f) => [
        {
          flock: f.batch,
          house: "all",
          birds_now: f.birdsNow,
          collected: fmtEggs(f.eggs, per),
          eggs: f.eggs,
          percent_production: percent(f.pct),
          share_of_eggs: share(f.eggs),
          rejects: f.rejects,
          feed_bags: Math.round((f.feedKg / S.feedBagKg) * 10) / 10,
          feed_kg: f.feedKg,
          g_per_bird_day: gramsPerBird(f.feedKg, f.feedDays, f.birdsNow),
          water_litres: f.litres,
          mortality: f.died,
          culls: f.culled,
        },
        ...(f.byHouse.length > 1
          ? f.byHouse.map((h) => ({
              flock: f.batch,
              house: h.house,
              birds_now: h.birds,
              collected: fmtEggs(h.eggs, per),
              eggs: h.eggs,
              percent_production: percent(h.pct),
              share_of_eggs: share(h.eggs),
              rejects: h.rejects,
              feed_bags: Math.round((h.feedKg / S.feedBagKg) * 10) / 10,
              feed_kg: h.feedKg,
              g_per_bird_day: gramsPerBird(h.feedKg, h.feedDays, h.birds),
              water_litres: h.litres,
              mortality: h.died,
              culls: h.culled,
            }))
          : []),
      ])
    );

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Flock analysis"
        sub="How each flock is doing, whichever houses it's in"
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={flocks.length === 0}
            className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b] disabled:opacity-50"
          >
            Download CSV
          </button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 px-4 py-3">
        {presets.map(([label, start]) => {
          const on = from === start && to === S.today;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                setFrom(start);
                setTo(S.today);
              }}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                on ? "border-[#055a5b] bg-[#e3efee] text-[#044647]" : "border-[#d6dfde] bg-white text-[#465657]"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-[13px] text-[#5d6b6b]">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={input} aria-label="From" />
          to
          <input type="date" value={to} min={from} max={S.today} onChange={(e) => setTo(e.target.value)} className={input} aria-label="To" />
        </span>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Flock</Th>
            <Th right>Birds now</Th>
            <Th right>Collected</Th>
            <Th right>% production</Th>
            <Th right>Share of eggs</Th>
            <Th right>Rejects</Th>
            <Th right>Feed</Th>
            <Th right>Feed a bird a day</Th>
            <Th right>Water</Th>
            <Th right>Mortality</Th>
            <Th right>Culls</Th>
          </THead>
          <tbody>
            {flocks.length === 0 ? (
              <TRow>
                <Td colSpan={11} className="text-[#84908f]">
                  No flocks to show for this period.
                </Td>
              </TRow>
            ) : null}
            {flocks.map((f) => (
              <Fragment key={f.batch}>
                <TRow>
                  <Td>
                    <span className="font-semibold">{f.batch}</span>
                    {f.status === "closed" ? (
                      <span className="ml-2">
                        <Badge label="closed" bg="#ebf0ef" fg="#5d6b6b" />
                      </span>
                    ) : null}
                    <div className="text-[12px] text-[#84908f]">{f.breed}</div>
                  </Td>
                  <Td right>{fmtK(f.birdsNow)}</Td>
                  <Td right className="font-semibold">
                    {fmtEggs(f.eggs, per)}
                  </Td>
                  <Td right className="font-semibold text-[#016559]">
                    {percent(f.pct)}
                  </Td>
                  <Td right>{share(f.eggs)}</Td>
                  <Td right>
                    {fmtK(f.rejects)}
                    <div className="text-[11.5px] text-[#84908f]">{pct(f.rejects, f.eggs)}</div>
                  </Td>
                  <Td right>{fmtBags(f.feedKg, S.feedBagKg)}</Td>
                  <Td right>{gramsPerBird(f.feedKg, f.feedDays, f.birdsNow)}</Td>
                  <Td right>{fmtK(f.litres)} L</Td>
                  <Td right>
                    <span style={{ color: f.died ? "#c7402f" : undefined }}>{fmtK(f.died)}</span>
                    <div className="text-[11.5px] text-[#84908f]">{pct(f.died, f.placed)}</div>
                  </Td>
                  <Td right>{fmtK(f.culled)}</Td>
                </TRow>
                {f.byHouse.length > 1
                  ? f.byHouse.map((h) => (
                      <TRow key={h.house}>
                        <Td className="text-[#5d6b6b]">
                          <span className="sm:pl-4">
                            {f.batch} in {h.house}
                          </span>
                        </Td>
                        <Td right>{fmtK(h.birds)}</Td>
                        <Td right>{fmtEggs(h.eggs, per)}</Td>
                        <Td right>{percent(h.pct)}</Td>
                        <Td right>{share(h.eggs)}</Td>
                        <Td right>{fmtK(h.rejects)}</Td>
                        <Td right>{fmtBags(h.feedKg, S.feedBagKg)}</Td>
                        <Td right>{gramsPerBird(h.feedKg, h.feedDays, h.birds)}</Td>
                        <Td right>{fmtK(h.litres)} L</Td>
                        <Td right>{fmtK(h.died)}</Td>
                        <Td right>{fmtK(h.culled)}</Td>
                      </TRow>
                    ))
                  : null}
              </Fragment>
            ))}
            {flocks.length > 1 ? (
              <TRow>
                <Td className="font-semibold">All flocks</Td>
                <Td right className="font-semibold">
                  {fmtK(sum((f) => f.birdsNow))}
                </Td>
                <Td right className="font-semibold">
                  {fmtEggs(sum((f) => f.eggs), per)}
                </Td>
                <Td right className="font-semibold text-[#016559]">
                  {percent(overallPct)}
                </Td>
                <Td right>{share(sum((f) => f.eggs))}</Td>
                <Td right>{fmtK(sum((f) => f.rejects))}</Td>
                <Td right>{fmtBags(sum((f) => f.feedKg), S.feedBagKg)}</Td>
                <Td right>—</Td>
                <Td right>{fmtK(sum((f) => f.litres))} L</Td>
                <Td right>{fmtK(sum((f) => f.died))}</Td>
                <Td right>{fmtK(sum((f) => f.culled))}</Td>
              </TRow>
            ) : null}
          </tbody>
        </Table>
      </Card>

      {unlinked.eggs || unlinked.feedKg || unlinked.litres ? (
        <p className="mt-3 rounded-xl bg-[#fcf2de] px-4 py-2.5 text-[13.5px] text-[#7a5410]">
          Not linked to a flock in this period: {fmtEggs(unlinked.eggs, per)} · {fmtBags(unlinked.feedKg, S.feedBagKg)} of feed ·{" "}
          {fmtK(unlinked.litres)} L of water. These are older entries, or ones from a house holding several flocks; they
          aren&apos;t in the figures above.
        </p>
      ) : null}

      <Note>
        {fmtD(from)} to {fmtD(to)}. % production is eggs ÷ birds alive on the days eggs were recorded (100 birds laying
        80 eggs a day is 80%), counting birds lost since, so days left blank don&apos;t pull it down. Share of eggs is each
        flock&apos;s part of all eggs in the period. Feed a bird a day is feed ÷ days logged ÷ birds now; mortality % is of
        the birds placed. A house split recently can read too high for dates before the split — pick dates after it.
      </Note>
    </>
  );
}
