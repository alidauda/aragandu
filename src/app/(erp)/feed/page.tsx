"use client";

import { monthName } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import {
  finishedPositions,
  fmtD,
  fmtK,
  fmtN,
  ingredientPositions,
  runPositions,
} from "@/lib/erp/derive";
import { Badge, Card, CardTitle, Kpi, Note, PageHeader } from "@/components/erp/ui";

export default function FeedDashboard() {
  const S = useErp();
  const ingPos = ingredientPositions(S.ingredients, S.deliveries, S.runs);
  const runPos = runPositions(S.runs, S.products);
  const finPos = finishedPositions(S.products, S.runs, S.feedSales);
  const lowCount = ingPos.filter((i) => i.st !== "in-stock").length;
  const salesMonth = S.feedSales
    .filter((s) => s.date >= S.today.slice(0, 8) + "01")
    .reduce((a, s) => a + s.bags * s.price, 0);

  const recent = [...runPos]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Overview"
        sub="Finished feed, low ingredients and the latest runs"
      />

      <div className="stagger grid grid-cols-4 gap-3.5">
        {[finPos[0], finPos[1]].map((p, i) =>
          p ? (
            <Kpi
              key={p.id}
              label={p.name}
              value={`${fmtK(Math.max(0, p.bags))} bags`}
              sub={`${fmtK(p.onHandKg)} kg on hand`}
            />
          ) : (
            <Kpi key={`none-${i}`} label="Finished feed" value="—" sub="no product yet" />
          )
        )}
        <Kpi
          label="Low ingredients"
          value={String(lowCount)}
          sub="below reorder level"
          color="#b3402f"
        />
        <Kpi
          label={`Feed sales — ${monthName(S.today)}`}
          value={fmtN(salesMonth)}
          sub="internal + external"
          color="#2f7cb6"
        />
      </div>

      <div className="mt-4 grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card className="px-5 py-4">
          <CardTitle>Latest production runs</CardTitle>
          <div className="mt-2.5">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-[#f0f1e6] py-[9px]"
              >
                <div className="w-[100px] text-[13.5px] font-bold">{r.run}</div>
                <div className="w-[52px] text-[12.5px] tabular-nums text-[#8a9070]">
                  {fmtD(r.date)}
                </div>
                <div className="flex-1 text-[13.5px]">{r.pname}</div>
                <div className="text-[13px] tabular-nums">{fmtK(r.output)} kg</div>
                <Badge
                  label={`${r.yieldPct.toFixed(1)}%`}
                  bg="#e8f2e5"
                  fg={r.yieldPct >= 97 ? "#3f6f3a" : "#a06a0e"}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-5 py-4">
          <CardTitle>Low ingredient stock</CardTitle>
          <div className="mt-2.5">
            {ingPos
              .filter((i) => i.st !== "in-stock")
              .map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between border-b border-[#f0f1e6] py-[7px]"
                >
                  <div className="text-[13.5px]">{i.name}</div>
                  <div className="text-[12.5px] font-bold tabular-nums text-[#b3402f]">
                    {fmtK(i.onHand)} kg left
                  </div>
                </div>
              ))}
          </div>
          <Note>Below reorder level — raise a purchase order.</Note>
        </Card>
      </div>
    </>
  );
}
