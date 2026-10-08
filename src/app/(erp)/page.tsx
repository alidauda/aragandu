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
} from "@/lib/erp/derive";
import {
  Badge,
  Card,
  CardTitle,
  Eyebrow,
  Note,
  PageHeader,
} from "@/components/erp/ui";

/** One column of the position board — figure, total mark, working. */
function Position({
  label,
  value,
  formula,
  color = "#1c2214",
}: {
  label: string;
  value: string;
  formula: string;
  color?: string;
}) {
  return (
    <div className="px-6 py-5 first:pl-7 last:pr-7">
      <Eyebrow>{label}</Eyebrow>
      <div
        className="font-data mt-2 text-[26px] font-semibold"
        style={{ color }}
      >
        {value}
      </div>
      <div className="total-mark" />
      <div className="font-data mt-2 text-[11px] leading-relaxed text-[#8a9070]">
        {formula}
      </div>
    </div>
  );
}

export default function CentralDashboard() {
  const S = useErp();

  const ingPos = ingredientPositions(S.ingredients, S.deliveries, S.runs);
  const runPos = runPositions(S.runs, S.products);
  const finPos = finishedPositions(S.products, S.runs, S.feedSales);
  const stock = eggStock(S.eggMoves, S.invoices);
  const debt = blockingDebt(S.invoices, S.weekStart);
  const mainFeed = finPos[0]; // undefined until a feed product exists

  const receivables = S.invoices
    .filter((v) => v.status === "pending")
    .reduce((a, v) => a + v.qty * v.price, 0);
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
  const toneBg = { g: "#e8f2e5", a: "#fdf3e0", n: "#eef0e4" } as const;
  const toneFg = { g: "#3f6f3a", a: "#a06a0e", n: "#59614a" } as const;

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
        eyebrow="Argandu Farms"
        title="Today’s position"
        sub="Every figure below is derived live from the ledgers — nothing stored, nothing stale"
      />

      <div className="stagger">
        <Card className="stagger grid grid-cols-4 divide-x divide-[#eef0e4]">
          <Position
            label="Egg stock"
            value={`${fmtK(stock)} cr`}
            formula={`${fmtK(gradedIn)} in − ${nonSaleOut} out − ${fmtK(soldCrates)} sold`}
          />
          {mainFeed ? (
            <Position
              label={mainFeed.name}
              value={`${fmtK(mainFeed.bags)} bags`}
              formula={`${fmtK(mainFeed.onHandKg)} kg ÷ ${mainFeed.bag} kg bag`}
            />
          ) : (
            <Position label="Finished feed" value="—" formula="no feed products yet" />
          )}
          <Position
            label="Receivables"
            value={fmtN(receivables)}
            formula={`${pendingCount} invoices unpaid`}
            color="#a06a0e"
          />
          <Position
            label="Pending work"
            value={String(pendingWork)}
            formula={`${pendingOrders} egg orders + ${pendingReqs} feed requests`}
            color="#2f7cb6"
          />
        </Card>
      </div>

      <div className="mt-3.5 grid grid-cols-[1.6fr_1fr] gap-3.5">
        <Card className="px-5 py-4">
          <CardTitle>Recent activity</CardTitle>
          <div className="mt-3 flex flex-col">
            {acts.slice(0, 8).map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[#f0f1e6] py-[9px]"
              >
                <div className="w-[52px] flex-shrink-0 text-xs tabular-nums text-[#8a9070]">
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
                <div className="py-2 text-[13px] text-[#8a9070]">
                  Everything above reorder level.
                </div>
              ) : (
                lowStock.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center justify-between border-b border-[#f0f1e6] py-[7px]"
                  >
                    <div className="text-[13.5px]">{l.name}</div>
                    <div className="text-[12.5px] font-bold tabular-nums text-[#b3402f]">
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
                <div className="py-2 text-[13px] text-[#8a9070]">
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
                    <div className="text-xs text-[#8a9070]">{d.sub}</div>
                  </div>
                  <div className="text-[13.5px] font-bold tabular-nums text-[#b3402f]">
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
