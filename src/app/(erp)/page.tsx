"use client";

import { useErp } from "@/lib/erp/store";
import {
  blockingDebt,
  eggStock,
  finishedPositions,
  fmtD,
  fmtK,
  fmtN,
  ingredientPositions,
  runPositions,
  receivablesOf,
} from "@/lib/erp/derive";
import { Banknote, ClipboardList, Egg, Wheat } from "lucide-react";

import {
  Badge,
  Card,
  CardTitle,
  ForestTile,
  Kpi,
  Note,
  PageHeader,
} from "@/components/erp/ui";

/** "Good morning, Ada" — by the farm's clock. */
function greeting(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(
      new Date()
    )
  );
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] ?? "";
  // "A. Folawiyo" reads better whole than as "A.".
  return `${part}, ${first.replace(".", "").length > 2 ? first : name.trim()}`;
}

export default function CentralDashboard() {
  const S = useErp();

  const ingPos = ingredientPositions(S.ingredients, S.deliveries, S.runs);
  const runPos = runPositions(S.runs, S.products);
  const finPos = finishedPositions(S.products, S.runs, S.feedSales);
  const stock = eggStock(S.eggMoves, S.invoices);
  const debt = blockingDebt(S.invoices, S.weekStart);
  const mainFeed = finPos[0]; // undefined until a feed product exists

  const receivables = receivablesOf(S.invoices);
  const pendingCount = S.invoices.filter((v) => v.status === "pending").length;
  const pendingWork =
    S.orders.filter((o) => o.status === "pending").length +
    S.reqs.filter((q) => q.status === "pending").length;

  const lowStock = ingPos
    .filter((i) => i.st !== "in-stock")
    .map((i) => ({ name: i.name, left: `${fmtK(i.onHand)} kg left` }));

  const debtRows = Object.entries(debt).map(([cid, owed]) => {
    const invs = S.invoices.filter(
      (v) => v.status === "pending" && v.cust === +cid && v.date < S.weekStart
    ).length;
    return {
      name: S.customers.find((c) => c.id === +cid)!.name,
      sub: `${invs} unpaid invoices`,
      owed: fmtN(owed),
    };
  });

  // Recent activity, merged across ledgers, newest first.
  const acts: { d: string; text: string; tag: string; tone: "g" | "a" | "n" }[] = [];
  S.prodLog.slice(0, 2).forEach((p) =>
    acts.push({ d: p.date, text: `${p.house} collected ${fmtK(p.eggs)} eggs`, tag: "Layers", tone: "g" })
  );
  runPos.slice(-2).forEach((r) =>
    acts.push({ d: r.date, text: `${r.run} produced ${fmtK(r.output)} kg ${r.pname}`, tag: "Feed", tone: "g" })
  );
  S.invoices.slice(0, 4).forEach((v) =>
    acts.push({
      d: v.date,
      text: `${v.name} — ${v.product} × ${v.qty} (${fmtN(v.qty * v.price)})`,
      tag: v.status === "paid" ? "Paid" : "Invoice",
      tone: v.status === "paid" ? "g" : "a",
    })
  );
  S.deliveries.slice(-1).forEach((d) =>
    acts.push({
      d: d.date,
      text: `${fmtK(d.kg)} kg ${S.ingredients.find((i) => i.id === d.ing)!.name} delivered @ ${fmtN(d.price)}/kg`,
      tag: "Delivery",
      tone: "n",
    })
  );
  acts.sort((a, b) => b.d.localeCompare(a.d));
  const toneBg = { g: "#e7f4ea", a: "#fcf2de", n: "#eef1ec" } as const;
  const toneFg = { g: "#23753a", a: "#9a6a12", n: "#4c5a51" } as const;

  const gradedIn = S.eggMoves
    .filter((m) => m.type === "in")
    .reduce((a, m) => a + m.crates, 0);
  const nonSaleOut = S.eggMoves
    .filter((m) => m.type === "out")
    .reduce((a, m) => a + m.crates, 0);
  const soldCrates = S.invoices
    .filter((v) => v.product === "Eggs (crates)")
    .reduce((a, v) => a + v.qty, 0);
  const pendingOrders = S.orders.filter((o) => o.status === "pending").length;
  const pendingReqs = S.reqs.filter((q) => q.status === "pending").length;

  return (
    <>
      <PageHeader
        title={`${greeting(S.viewer.name)}`}
        sub="Where the farm stands right now — every figure comes straight from today’s records."
      />

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ForestTile
          label="Eggs in store"
          value={`${fmtK(stock)} crates`}
          sub={`${fmtK(gradedIn)} graded in, ${nonSaleOut} out, ${fmtK(soldCrates)} sold`}
          icon={Egg}
        />
        {mainFeed ? (
          <Kpi
            label={mainFeed.name}
            value={`${fmtK(mainFeed.bags)} bags`}
            sub={`${fmtK(mainFeed.onHandKg)} kg in ${mainFeed.bag} kg bags`}
            icon={Wheat}
          />
        ) : (
          <Kpi label="Finished feed" value="—" sub="No feed products yet" icon={Wheat} />
        )}
        <Kpi
          label="Owed to the farm"
          value={fmtN(receivables)}
          sub={`${pendingCount} unpaid invoice${pendingCount === 1 ? "" : "s"}`}
          color="#9a6a12"
          icon={Banknote}
        />
        <Kpi
          label="Waiting on you"
          value={String(pendingWork)}
          sub={`${pendingOrders} egg order${pendingOrders === 1 ? "" : "s"}, ${pendingReqs} feed request${pendingReqs === 1 ? "" : "s"}`}
          color="#3a8bd6"
          icon={ClipboardList}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="px-5 py-4">
          <CardTitle>Recent activity</CardTitle>
          <div className="mt-3 flex flex-col">
            {acts.slice(0, 8).map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#eef1ec] py-[9px]"
              >
                <div className="w-[52px] flex-shrink-0 text-xs tabular-nums text-[#8b958d]">
                  {fmtD(a.d)}
                </div>
                <div className="flex-1 text-[13.5px]">{a.text}</div>
                <Badge label={a.tag} bg={toneBg[a.tone]} fg={toneFg[a.tone]} />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="px-5 py-4">
            <CardTitle>Low stock — feed mill</CardTitle>
            <div className="mt-2.5">
              {lowStock.length === 0 ? (
                <div className="py-2 text-[13px] text-[#8b958d]">
                  Everything above reorder level.
                </div>
              ) : (
                lowStock.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center justify-between border-b border-[#eef1ec] py-[7px]"
                  >
                    <div className="text-[13.5px]">{l.name}</div>
                    <div className="text-[12.5px] font-bold tabular-nums text-[#c7402f]">
                      {l.left}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Note>Below reorder level — raise a purchase order.</Note>
          </Card>

          <Card className="px-5 py-4">
            <CardTitle>Blocking debt</CardTitle>
            <div className="mt-2.5">
              {debtRows.length === 0 ? (
                <div className="py-2 text-[13px] text-[#8b958d]">
                  No buyer is on debt hold.
                </div>
              ) : null}
              {debtRows.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between py-[7px]"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold">{d.name}</div>
                    <div className="text-xs text-[#8b958d]">{d.sub}</div>
                  </div>
                  <div className="text-[13.5px] font-bold tabular-nums text-[#c7402f]">
                    {d.owed}
                  </div>
                </div>
              ))}
            </div>
            <Note>
              Unpaid invoices from before this week block new portal orders.
            </Note>
          </Card>
        </div>
      </div>
    </>
  );
}
