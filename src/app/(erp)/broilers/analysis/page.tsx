"use client";

import { broilerStats, fmtKg } from "@/lib/erp/broilers";
import { downloadCsv } from "@/lib/csv";
import { fmtAge, fmtBags, fmtK, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Badge, Card, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

/** Every batch side by side: liveability, weight, feed and FCR. */
export default function BroilerAnalysis() {
  const S = useErp();
  const stats = broilerStats(S, S.today).sort((a, b) => b.received.localeCompare(a.received));
  const paged = usePaged(stats);
  const pct = (n: number) => `${n.toFixed(1)}%`;

  const exportCsv = () =>
    downloadCsv(
      `argandu-broilers-${S.today}.csv`,
      stats.map((b) => ({
        batch: b.batch,
        breed: b.breed,
        house: b.house ?? "",
        status: b.status,
        arrived: b.received,
        age: b.ageDays === null ? "" : fmtAge(b.ageDays),
        placed: b.placed,
        alive: b.alive,
        died: b.died,
        culled: b.culled,
        liveability_pct: b.liveability.toFixed(1),
        feed_kg: Math.round(b.feedKg),
        feed_bags: Math.round((b.feedKg / S.feedBagKg) * 10) / 10,
        feed_per_bird_kg: b.placed ? (b.feedKg / b.placed).toFixed(2) : "",
        avg_weight_kg: b.weightKg === null ? "" : b.weightKg.toFixed(3),
        sold_birds: b.soldBirds,
        sold_kg: b.soldKg,
        fcr: b.fcr === null ? "" : b.fcr.toFixed(2),
        epef: b.epef === null ? "" : Math.round(b.epef),
        water_litres: b.litres,
        birds_processed: b.processedBirds,
        carcass_kg: b.carcassKg,
        yield_pct: b.yieldPct === null ? "" : b.yieldPct.toFixed(1),
        costs: Math.round(b.costs),
      }))
    );

  return (
    <>
      <PageHeader
        eyebrow="Broilers"
        title="Analysis"
        sub="Every batch side by side"
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={stats.length === 0}
            className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b] disabled:opacity-50"
          >
            Download CSV
          </button>
        }
      />

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={paged.pager}>
          <THead>
            <Th>Batch</Th>
            <Th right>Age</Th>
            <Th right>Placed</Th>
            <Th right>Liveability</Th>
            <Th right>Feed</Th>
            <Th right>Weight</Th>
            <Th right>Sold</Th>
            <Th right>FCR</Th>
            <Th right>EPEF</Th>
            <Th right>Costs</Th>
          </THead>
          <tbody>
            {stats.length === 0 ? (
              <TRow>
                <Td colSpan={10} className="text-[#84908f]">
                  No batches yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((b) => (
              <TRow key={b.batch}>
                <Td>
                  <span className="font-semibold">{b.batch}</span>
                  {b.status === "closed" ? (
                    <span className="ml-2">
                      <Badge label="closed" bg="#ebf0ef" fg="#5d6b6b" />
                    </span>
                  ) : null}
                  <div className="text-[12px] text-[#84908f]">
                    {b.breed}
                    {b.house ? ` · ${b.house}` : ""}
                  </div>
                </Td>
                <Td right>{b.ageDays === null ? "—" : fmtAge(b.ageDays)}</Td>
                <Td right>
                  {fmtK(b.placed)}
                  <div className="text-[11.5px] text-[#84908f]">{fmtK(b.alive)} alive</div>
                </Td>
                <Td right>
                  {pct(b.liveability)}
                  <div className="text-[11.5px] text-[#84908f]">
                    {fmtK(b.died)} died · {fmtK(b.culled)} culled
                  </div>
                </Td>
                <Td right>
                  {fmtBags(b.feedKg, S.feedBagKg)}
                  <div className="text-[11.5px] text-[#84908f]">{b.placed ? fmtKg(b.feedKg / b.placed, 2) : "—"} a bird</div>
                </Td>
                <Td right>
                  {fmtKg(b.weightKg, 3)}
                  <div className="text-[11.5px] text-[#84908f]">{b.dailyGain === null ? "" : `${Math.round(b.dailyGain)} g a day`}</div>
                </Td>
                <Td right>
                  {fmtK(b.soldBirds)}
                  <div className="text-[11.5px] text-[#84908f]">{fmtKg(b.soldKg, 0)}</div>
                </Td>
                <Td right className="font-semibold">
                  {b.fcr === null ? "—" : b.fcr.toFixed(2)}
                </Td>
                <Td right className="font-semibold">
                  {b.epef === null ? "—" : Math.round(b.epef)}
                </Td>
                <Td right>
                  {fmtN(b.costs)}
                  {b.yieldPct !== null ? <div className="text-[11.5px] text-[#84908f]">{b.yieldPct.toFixed(1)}% yield</div> : null}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Sold includes birds processed, at their live weight. Costs are the batch&apos;s own expenses and the cost of
        processing it; feed isn&apos;t costed here yet. Liveability is birds that didn&apos;t die or get culled ÷ birds placed. Weight is the last sample weighed, or the
        average sold for a closed batch. FCR = feed ÷ live weight produced (sold + on the farm − the chicks&apos; weight):
        lower is better. EPEF = liveability × weight in kg × 100 ÷ (age in days × FCR): higher is better.
      </Note>
    </>
  );
}
