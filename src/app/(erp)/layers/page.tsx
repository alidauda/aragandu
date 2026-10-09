"use client";

import Link from "next/link";

import { shortDay } from "@/lib/dates";
import { Activity, ClipboardList, Egg, Package } from "lucide-react";

import { useErp } from "@/lib/erp/store";
import {
  activeBirds,
  blockingDebt,
  dailyGoodEggs,
  eggStock,
  fmtD,
  fmtK,
  fmtN,
  todaysEggs,
  ungradedEggs,
  withdrawals,
} from "@/lib/erp/derive";
import { Card, CardTitle, ForestTile, Kpi, Note, PageHeader } from "@/components/erp/ui";
import { EggsFeedChart } from "@/components/erp/EggsFeedChart";

export default function LayersDashboard() {
  const S = useErp();
  const stock = eggStock(S.eggMoves, S.invoices);
  const debt = blockingDebt(S.invoices, S.weekStart);
  const eggs = todaysEggs(S.prodLog, S.today);
  const birds = activeBirds(S.batches, S.today);
  const pendingOrders = S.orders.filter((o) => o.status === "pending");

  // Things that need someone's attention today.
  const alerts: { text: string; href: string; tone: "red" | "amber" }[] = [];
  for (const [house, until] of withdrawals(S.vaccinations, S.medications, S.today)) {
    alerts.push({ text: `${house} is in a drug withdrawal until ${fmtD(until)} — its eggs are withheld`, href: "/layers/health", tone: "red" });
  }
  const ungraded = ungradedEggs(S.prodLog, S.eggMoves, S.eggsPerCrate);
  const perDay = dailyGoodEggs(S.prodLog, S.today);
  if (perDay > 0 && ungraded > perDay * 2) {
    alerts.push({ text: `${fmtK(ungraded)} good eggs collected but not graded — more than two days' laying`, href: "/layers/egg-inventory", tone: "amber" });
  }
  const pendingOuts = S.eggMoves.filter((m) => m.status === "pending").length;
  if (pendingOuts) {
    alerts.push({ text: `${pendingOuts} write-off${pendingOuts > 1 ? "s" : ""} waiting for an admin`, href: "/layers/egg-inventory", tone: "amber" });
  }
  const overdue = S.vaccinations.filter((v) => v.status !== "done" && v.date < S.today).length;
  if (overdue) {
    alerts.push({ text: `${overdue} scheduled vaccination${overdue > 1 ? "s are" : " is"} overdue`, href: "/layers/health", tone: "red" });
  }
  const expired = pendingOrders.filter((o) => o.date < S.weekStart).length;
  if (expired) {
    alerts.push({ text: `${expired} order${expired > 1 ? "s" : ""} from last week expired — decline ${expired > 1 ? "them" : "it"}`, href: "/layers/orders", tone: "amber" });
  }

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Overview"
        sub="Lay rate, egg stock and pending work at a glance"
      />

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ForestTile
          label="Eggs collected today"
          value={fmtK(eggs)}
          sub="All houses"
          icon={Egg}
        />
        <Kpi
          label="Lay rate"
          value={birds > 0 ? `${((100 * eggs) / birds).toFixed(1)}%` : "—"}
          sub={`${fmtK(birds)} birds in lay`}
          icon={Activity}
        />
        <Kpi
          label="Eggs in store"
          value={`${fmtK(stock)} crates`}
          sub="Graded in, less sold and out"
          color="#3a8bd6"
          icon={Package}
        />
        <Kpi
          label="Orders waiting"
          value={String(pendingOrders.length)}
          sub={`Week of ${shortDay(S.weekStart)}`}
          color="#9a6a12"
          icon={ClipboardList}
        />
      </div>

      {alerts.length ? (
        <Card className="mt-4 px-5 py-3">
          {alerts.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className="flex items-center gap-2.5 border-b border-[#eef1ec] py-2.5 text-[14px] last:border-0 hover:text-[#2f8f46]"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === "red" ? "bg-[#c7402f]" : "bg-[#d99a2b]"}`} />
              {a.text}
            </Link>
          ))}
        </Card>
      ) : null}

      <div className="mt-4">
        <EggsFeedChart prodLog={S.prodLog} feedUse={S.feedUse} birds={birds} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3.5">
        <Card className="px-5 py-4">
          <CardTitle>Latest collections</CardTitle>
          <div className="mt-2.5">
            {S.prodLog.slice(0, 4).map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#eef1ec] py-[9px]"
              >
                <div className="w-[52px] text-[12.5px] tabular-nums text-[#8b958d]">
                  {fmtD(p.date)}
                </div>
                <div className="w-[56px] text-[13.5px] font-bold">{p.house}</div>
                <div className="flex-1 text-[13.5px] tabular-nums">
                  {fmtK(p.eggs)} eggs
                </div>
                <div className="text-[13px] font-semibold tabular-nums text-[#23753a]">
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
                  className="flex items-center justify-between border-b border-[#eef1ec] py-2"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold">{c.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: hold ? "#c7402f" : "#8b958d" }}
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
