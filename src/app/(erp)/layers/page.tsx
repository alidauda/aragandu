"use client";

import { shortDay } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import {
  activeBirds,
  blockingDebt,
  eggStock,
  fmtD,
  fmtK,
  fmtN,
  todaysEggs,
} from "@/lib/erp/derive";
import { Card, CardTitle, Kpi, Note, PageHeader } from "@/components/erp/ui";
import { EggsFeedChart } from "@/components/erp/EggsFeedChart";

export default function LayersDashboard() {
  const S = useErp();
  const stock = eggStock(S.eggMoves, S.invoices);
  const debt = blockingDebt(S.invoices, S.weekStart);
  const eggs = todaysEggs(S.prodLog, S.today);
  const birds = activeBirds(S.batches);
  const pendingOrders = S.orders.filter((o) => o.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Overview"
        sub="Lay rate, egg stock and pending work at a glance"
      />

      <div className="stagger grid grid-cols-4 gap-3.5">
        <Kpi label="Today’s eggs" value={fmtK(eggs)} sub="across all houses" />
        <Kpi
          label="Lay rate"
          value={birds > 0 ? `${((100 * eggs) / birds).toFixed(1)}%` : "—"}
          sub={`${fmtK(birds)} birds in lay`}
        />
        <Kpi
          label="Egg stock"
          value={`${fmtK(stock)} crates`}
          sub="derived, never stored"
          color="#2f7cb6"
        />
        <Kpi
          label="Pending orders"
          value={String(pendingOrders.length)}
          sub={`week of ${shortDay(S.weekStart)}`}
          color="#a06a0e"
        />
      </div>

      <div className="mt-4">
        <EggsFeedChart prodLog={S.prodLog} feedUse={S.feedUse} birds={birds} />
      </div>

      <div className="mt-4 grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card className="px-5 py-4">
          <CardTitle>Latest collections</CardTitle>
          <div className="mt-2.5">
            {S.prodLog.slice(0, 4).map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#f0f1e6] py-[9px]"
              >
                <div className="w-[52px] text-[12.5px] tabular-nums text-[#8a9070]">
                  {fmtD(p.date)}
                </div>
                <div className="w-[56px] text-[13.5px] font-bold">{p.house}</div>
                <div className="flex-1 text-[13.5px] tabular-nums">
                  {fmtK(p.eggs)} eggs
                </div>
                <div className="text-[13px] font-semibold tabular-nums text-[#3f6f3a]">
                  {fmtK(p.eggs - p.cracked - p.rejects)} good
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-5 py-4">
          <CardTitle>Pending portal orders</CardTitle>
          <div className="mt-2.5">
            {pendingOrders.map((o) => {
              const c = S.customers.find((c) => c.id === o.cust)!;
              const hold = !!debt[o.cust];
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between border-b border-[#f0f1e6] py-2"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold">{c.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: hold ? "#b3402f" : "#8a9070" }}
                    >
                      {hold
                        ? `Debt hold — ${fmtN(debt[o.cust])}`
                        : `${fmtD(o.date)} · in allocation`}
                    </div>
                  </div>
                  <div className="text-[13.5px] font-bold tabular-nums">
                    {o.crates} cr
                  </div>
                </div>
              );
            })}
          </div>
          <Note>Fulfil them under the Egg orders tab.</Note>
        </Card>
      </div>
    </>
  );
}
