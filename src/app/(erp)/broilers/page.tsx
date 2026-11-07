"use client";

import Link from "next/link";

import { broilerFeedPosition, broilerStats, fmtKg as kg } from "@/lib/erp/broilers";
import { addDays, fmtAge, fmtBags, fmtD, fmtK } from "@/lib/erp/derive";
import { useBirdUnit } from "@/components/erp/useUnit";
import { Card, CardTitle, Kpi, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

/** Broilers at a glance: birds, weight, feed and how each batch is doing. */
export default function BroilersOverview() {
  const S = useBirdUnit();
  const stats = broilerStats(S, S.today).filter((b) => b.status === "active");
  const paged = usePaged(stats);
  const feed = broilerFeedPosition(S, S.today, S.unit);
  const weekAgo = addDays(S.today, -6);
  const diedWeek = S.broilerDaily.filter((r) => r.date >= weekAgo).reduce((a, r) => a + r.died, 0);
  const alive = stats.reduce((a, b) => a + b.alive, 0);

  return (
    <>
      <PageHeader
        eyebrow={S.u.label}
        title="Overview"
        sub={`Birds, weight and feed across the ${S.u.label.toLowerCase()} houses`}
        action={
          <Link
            href={`${S.u.base}/daily`}
            className="font-sub rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] text-white hover:bg-[#044647]"
          >
            Daily entry
          </Link>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Birds alive" value={fmtK(alive)} sub={`${stats.length} ${stats.length === 1 ? "batch" : "batches"} growing`} color="#055a5b" />
        <Kpi
          label="Feed stock"
          value={fmtBags(Math.max(0, feed.stockKg), S.feedBagKg)}
          sub={feed.daysCover ? `about ${feed.daysCover} days` : "no recent use"}
          color={feed.stockKg < 0 ? "#c7402f" : undefined}
        />
        <Kpi label="Died this week" value={fmtK(diedWeek)} sub="last 7 days" color={diedWeek ? "#c7402f" : undefined} />
        <Kpi label="Used today" value={fmtBags(feed.usedToday, S.feedBagKg)} sub="all batches" color="#9a6a12" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Batches growing</CardTitle>
        </div>
        <div className="mt-2">
          <Table pager={paged.pager}>
            <THead>
              <Th>Batch</Th>
              <Th right>Age</Th>
              <Th right>Alive</Th>
              <Th right>Average weight</Th>
              <Th right>Gain a day</Th>
              <Th right>FCR</Th>
              <Th right>Liveability</Th>
              <Th right>EPEF</Th>
            </THead>
            <tbody>
              {stats.length === 0 ? (
                <TRow>
                  <Td colSpan={8} className="text-[#84908f]">
                    No batches growing. Add one on Batches.
                  </Td>
                </TRow>
              ) : null}
              {paged.rows.map((b) => (
                <TRow key={b.batch}>
                  <Td>
                    <span className="font-semibold">{b.batch}</span>
                    <div className="text-[12px] text-[#84908f]">
                      {b.house ?? "no house"} · {b.breed}
                    </div>
                  </Td>
                  <Td right>{b.ageDays === null ? "—" : fmtAge(b.ageDays)}</Td>
                  <Td right>{fmtK(b.alive)}</Td>
                  <Td right>
                    {kg(b.weightKg, 3)}
                    {b.lastWeighed ? <div className="text-[11.5px] text-[#84908f]">{fmtD(b.lastWeighed)}</div> : null}
                  </Td>
                  <Td right>{b.dailyGain === null ? "—" : `${Math.round(b.dailyGain)} g`}</Td>
                  <Td right>{b.fcr === null ? "—" : b.fcr.toFixed(2)}</Td>
                  <Td right>{b.liveability.toFixed(1)}%</Td>
                  <Td right>{b.epef === null ? "—" : Math.round(b.epef)}</Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Average weight is the latest sample weighed. FCR is feed ÷ the live weight the batch has put on (sold, plus birds
        on the farm at their last weight, less their weight as chicks): lower is better. EPEF combines liveability,
        weight, age and FCR into one score: higher is better.
      </Note>
    </>
  );
}
