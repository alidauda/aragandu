"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, Bird, ClipboardList, TrendingUp } from "lucide-react";

import { useErp } from "@/lib/erp/store";
import {
  blockingDebt,
  eggStock,
  feedByType,
  finishedPositions,
  latestProduction,
  fmtBags,
  fmtD,
  fmtEggs,
  fmtK,
  fmtN,
  ingredientPositions,
  inventoryPositions,
  layersFeedPosition,
  millFeed,
  receivablesOf,
  runPositions,
} from "@/lib/erp/derive";
import { broilerFeedPosition, broilerStats, fmtKg } from "@/lib/erp/broilers";
import { divisionSummary, monthlySummary } from "@/lib/erp/finance";
import type { BirdUnit } from "@/lib/erp/types";
import { Badge, Card, CardTitle, ForestTile, Kpi, Note, PageHeader } from "@/components/erp/ui";

/** "Good morning, Ada" — by the farm's clock. */
function greeting(name: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(new Date())
  );
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] ?? "";
  // "A. Folawiyo" reads better whole than as "A.".
  return `${part}, ${first.replace(".", "").length > 2 ? first : name.trim()}`;
}

type Line = { label: string; value: string; tone?: "bad" | "warn" | "good" };
const TONE = { bad: "#c7402f", warn: "#9a6a12", good: "#016559" } as const;

/** One division at a glance, linking to its pages. */
function DivisionCard({ title, href, lines }: { title: string; href: string; lines: Line[] }) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Link href={href} className="text-[12.5px] font-semibold text-[#055a5b] hover:underline">
          Open →
        </Link>
      </div>
      <div className="mt-2.5">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3 border-b border-[#ebf0ef] py-[7px] text-[13.5px] last:border-0">
            <span className="text-[#465657]">{l.label}</span>
            <span className="font-data text-right font-semibold" style={{ color: l.tone ? TONE[l.tone] : undefined }}>
              {l.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * The whole farm at a glance — for the owner and farm-wide members: every
 * division, the month's money, and what needs attention.
 * Each part shows only to those who may see it.
 */
export default function CentralDashboard() {
  const S = useErp();
  const can = S.can;
  const month = S.today.slice(0, 7);
  const monthStart = `${month}-01`;
  const inMonth = (d?: string) => !!d && d.slice(0, 7) === month;
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

  // ── Layers
  const stock = eggStock(S.eggMoves, S.invoices);
  const layersFeed = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse, S.today);
  const latest = latestProduction(S.batches, S.prodLog, S.today);
  const layerBirds = sum(S.batches.filter((b) => b.st === "active"), (b) => b.birds - b.mortality);
  const eggsToday = sum(S.prodLog.filter((p) => p.date === S.today), (p) => p.eggs);

  // ── Broilers and Brooding share records: each unit's own view.
  const unitView = (unit: BirdUnit) => {
    const batches = S.broilerBatches.filter((b) => b.unit === unit);
    const codes = new Set(batches.map((b) => b.batch));
    const mine = <T extends { batch: string }>(rows: T[]) => rows.filter((r) => codes.has(r.batch));
    const view = {
      ...S,
      broilerBatches: batches,
      broilerDaily: mine(S.broilerDaily),
      broilerWeighings: mine(S.broilerWeighings),
      broilerSales: mine(S.broilerSales),
      broilerProcessing: mine(S.broilerProcessing),
      broodingDispatches: mine(S.broodingDispatches),
      broilerFeedDeliveries: S.broilerFeedDeliveries.filter((d) => d.unit === unit),
      broilerExpenses: S.broilerExpenses.filter((e) => e.unit === unit),
    };
    const stats = broilerStats(view, S.today).filter((b) => b.status === "active");
    return { stats, feed: broilerFeedPosition(view, S.today, unit), view };
  };
  const broilers = unitView("broilers");
  const brooding = unitView("brooding");
  const birdsIn = (u: ReturnType<typeof unitView>) => sum(u.stats, (b) => b.alive);
  const weighted = (u: ReturnType<typeof unitView>) => {
    const w = u.stats.filter((b) => b.weightKg !== null);
    const birds = sum(w, (b) => b.alive);
    return birds ? sum(w, (b) => b.alive * (b.weightKg ?? 0)) / birds : null;
  };
  const dispatchedMonth = sum(S.broodingDispatches.filter((x) => inMonth(x.date)), (x) => x.birds);

  // ── Ruminants
  const herd = S.animals.filter((a) => a.status === "active");
  const ruminantFeed = sum(
    feedByType(
      S.products,
      [...S.broilerFeedDeliveries.filter((d) => d.unit === "ruminants"), ...millFeed(S.feedSales, S.products, "ruminants")],
      S.ruminantFeed
    ),
    (r) => r.stock
  );

  // ── Feed mill
  const ingPos = ingredientPositions(S.ingredients, S.deliveries, S.runs);
  const runPos = runPositions(S.runs, S.products);
  const finPos = finishedPositions(S.products, S.runs, S.feedSales);
  const finishedKg = sum(finPos, (p) => Math.max(0, p.onHandKg));
  const madeMonth = sum(runPos.filter((r) => inMonth(r.date)), (r) => r.output);
  const pendingReqs = S.reqs.filter((q) => q.status === "pending").length;

  // ── Money
  const receivables = receivablesOf(S.invoices);
  const salesMonth = sum(S.invoices.filter((v) => inMonth(v.date)), (v) => v.qty * v.price);
  const collectedMonth = sum(S.payments.filter((p) => p.date >= monthStart && p.method !== "credit"), (p) => p.amount);
  const debt = blockingDebt(S.invoices, S.weekStart);
  const debtRows = Object.entries(debt).map(([cid, owed]) => ({
    name: S.customers.find((c) => c.id === +cid)?.name ?? "—",
    sub: `${S.invoices.filter((v) => v.status === "pending" && v.cust === +cid && v.date < S.weekStart).length} unpaid invoices`,
    owed: fmtN(owed),
  }));

  // ── Finance: the month's net for the whole farm.
  const finance = can("finance");
  const layersMonth = finance ? monthlySummary(S, month) : null;
  const divisionsMonth = finance ? divisionSummary(S, month) : null;
  const farmNet =
    layersMonth && divisionsMonth
      ? layersMonth.totals.net + (layersMonth.growing.length ? layersMonth.growers.net : 0) + divisionsMonth.total.net
      : null;

  // ── What needs someone's attention, across the farm.
  const lowInventory = can("inventory") ? inventoryPositions(S.invItems, S.invMoves).filter((i) => i.st !== "in-stock") : [];
  const lowIngredients = can("feed") ? ingPos.filter((i) => i.st !== "in-stock") : [];
  const pendingOrders = S.orders.filter((o) => o.status === "pending" && o.paidAt).length;
  const pendingWriteOffs = S.eggMoves.filter((m) => m.status === "pending").length;
  const feedLow = (label: string, cover: number, stockKg: number, href: string) =>
    stockKg > 0 && cover > 0 && cover < 7 ? [{ text: `${label} feed lasts about ${cover} days`, href, tone: "warn" as const }] : [];
  const attention: { text: string; href: string; tone: "bad" | "warn" }[] = [
    ...(can("layers") ? feedLow("Layers", layersFeed.daysCover, layersFeed.stockKg, "/layers/feed") : []),
    ...(can("broilers") ? feedLow("Broilers", broilers.feed.daysCover, broilers.feed.stockKg, "/broilers/feed") : []),
    ...(can("brooding") ? feedLow("Brooding", brooding.feed.daysCover, brooding.feed.stockKg, "/brooding/feed") : []),
    ...(can("layers") && layersFeed.stockKg < 0 ? [{ text: "Layers has used more feed than it received", href: "/layers/feed", tone: "bad" as const }] : []),
    ...(lowIngredients.length ? [{ text: `${lowIngredients.length} ingredients below reorder level at the mill`, href: "/feed/ingredients", tone: "warn" as const }] : []),
    ...(lowInventory.length ? [{ text: `${lowInventory.length} store items low or out`, href: "/inventory", tone: "warn" as const }] : []),
    ...(can("eggsales") && pendingOrders ? [{ text: `${pendingOrders} paid egg orders waiting`, href: "/layers/orders", tone: "warn" as const }] : []),
    ...(can("requests") && pendingReqs ? [{ text: `${pendingReqs} feed requests waiting at the mill`, href: "/feed/requests", tone: "warn" as const }] : []),
    ...(can("layers") && pendingWriteOffs ? [{ text: `${pendingWriteOffs} egg write-offs to review`, href: "/layers/egg-inventory", tone: "warn" as const }] : []),
    ...(debtRows.length && can("customers") ? [{ text: `${debtRows.length} buyers on debt hold`, href: "/customers", tone: "bad" as const }] : []),
  ];

  // Recent activity, merged across ledgers, newest first.
  const acts: { d: string; text: string; tag: string; tone: "g" | "a" | "n" }[] = [];
  S.prodLog.slice(0, 2).forEach((p) => acts.push({ d: p.date, text: `${p.house} collected ${fmtEggs(p.eggs, S.eggsPerCrate)}`, tag: "Layers", tone: "g" }));
  runPos.slice(-2).forEach((r) => acts.push({ d: r.date, text: `${r.run} produced ${fmtK(r.output)} kg ${r.pname}`, tag: "Feed", tone: "g" }));
  S.broilerWeighings.slice(0, 2).forEach((w) =>
    acts.push({ d: w.date, text: `${w.batch} weighed at ${fmtKg(w.kg / w.birds, 2)} a bird`, tag: S.broilerBatches.find((b) => b.batch === w.batch)?.unit === "brooding" ? "Brooding" : "Broilers", tone: "n" })
  );
  S.broodingDispatches.slice(0, 1).forEach((x) =>
    acts.push({ d: x.date, text: `${fmtK(x.birds)} birds from ${x.batch} to ${x.layersBatch ? `Layers ${x.layersBatch}` : `Broilers ${x.broilerBatch}`}`, tag: "Brooding", tone: "g" })
  );
  S.animals
    .filter((a) => a.source === "born")
    .slice(-1)
    .forEach((a) => acts.push({ d: a.joined, text: `${a.tag} born to ${a.dam}`, tag: "Ruminants", tone: "g" }));
  S.invoices.slice(0, 4).forEach((v) =>
    acts.push({
      d: v.date,
      text: `${v.name} — ${v.product} × ${v.qty} (${fmtN(v.qty * v.price)})`,
      tag: v.status === "paid" ? "Paid" : "Invoice",
      tone: v.status === "paid" ? "g" : "a",
    })
  );
  acts.sort((a, b) => b.d.localeCompare(a.d));
  const toneBg = { g: "#e2f0ed", a: "#fcf2de", n: "#ebf0ef" } as const;
  const toneFg = { g: "#016559", a: "#9a6a12", n: "#465657" } as const;

  // Feed on hand everywhere: finished at the mill, and in each division's store.
  const feedStores = [
    ...(can("layers") ? [{ name: "Layers", kg: Math.max(0, layersFeed.stockKg), cover: layersFeed.daysCover }] : []),
    ...(can("broilers") ? [{ name: "Broilers", kg: Math.max(0, broilers.feed.stockKg), cover: broilers.feed.daysCover }] : []),
    ...(can("brooding") ? [{ name: "Brooding", kg: Math.max(0, brooding.feed.stockKg), cover: brooding.feed.daysCover }] : []),
    ...(can("ruminants") ? [{ name: "Ruminants", kg: Math.max(0, ruminantFeed), cover: 0 }] : []),
  ];
  const allFeedKg = (can("feed") ? finishedKg : 0) + sum(feedStores, (f) => f.kg);
  const birdsOnFarm = (can("layers") ? layerBirds : 0) + (can("broilers") ? birdsIn(broilers) : 0) + (can("brooding") ? birdsIn(brooding) : 0);

  return (
    <>
      <PageHeader title={greeting(S.viewer.name)} sub="The whole farm at a glance — every figure straight from today's records." />

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can("money") || can("eggsales") ? (
          <ForestTile label="Sales this month" value={fmtN(salesMonth)} sub={`${fmtN(collectedMonth)} collected · ${fmtN(receivables)} owed`} icon={Banknote} />
        ) : null}
        {farmNet !== null ? (
          <Kpi label="Net this month" value={farmNet < 0 ? `(${fmtN(-farmNet)})` : fmtN(farmNet)} sub="every division, after every cost" color={farmNet < 0 ? "#c7402f" : "#016559"} icon={TrendingUp} />
        ) : (
          <Kpi label="Owed to the farm" value={fmtN(receivables)} sub={`${S.invoices.filter((v) => v.status === "pending").length} unpaid invoices`} color="#9a6a12" icon={Banknote} />
        )}
        <Kpi
          label="Birds on the farm"
          value={fmtK(birdsOnFarm)}
          sub={can("ruminants") ? `and ${fmtK(herd.length)} ruminants` : "layers, broilers and brooding"}
          icon={Bird}
        />
        <Kpi label="Needs attention" value={String(attention.length)} sub={attention.length ? "see the list below" : "nothing waiting"} color={attention.length ? "#c7402f" : "#016559"} icon={attention.length ? AlertTriangle : ClipboardList} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {can("layers") ? (
          <DivisionCard
            title="Layers"
            href="/layers"
            lines={[
              { label: "Birds", value: fmtK(layerBirds) },
              { label: "Eggs today", value: fmtEggs(eggsToday, S.eggsPerCrate) },
              {
                label: latest && latest.day !== S.today ? `% production, ${fmtD(latest.day)}` : "% production today",
                value: latest?.pct != null ? `${latest.pct.toFixed(1)}%` : "—",
              },
              { label: "Eggs in store", value: `${fmtK(stock)} crates` },
              { label: "Feed", value: `${fmtBags(Math.max(0, layersFeed.stockKg), S.feedBagKg)}${layersFeed.daysCover ? ` · ${layersFeed.daysCover} days` : ""}`, tone: layersFeed.daysCover && layersFeed.daysCover < 7 ? "warn" : undefined },
            ]}
          />
        ) : null}
        {can("broilers") ? (
          <DivisionCard
            title="Broilers"
            href="/broilers"
            lines={[
              { label: "Birds", value: `${fmtK(birdsIn(broilers))} in ${broilers.stats.length} ${broilers.stats.length === 1 ? "batch" : "batches"}` },
              { label: "Average weight", value: fmtKg(weighted(broilers), 2) },
              { label: "Sold this month", value: fmtN(sum(S.invoices.filter((v) => inMonth(v.date) && v.product.startsWith("Broiler")), (v) => v.qty * v.price)) },
              { label: "Feed", value: `${fmtBags(Math.max(0, broilers.feed.stockKg), S.feedBagKg)}${broilers.feed.daysCover ? ` · ${broilers.feed.daysCover} days` : ""}`, tone: broilers.feed.daysCover && broilers.feed.daysCover < 7 ? "warn" : undefined },
            ]}
          />
        ) : null}
        {can("brooding") ? (
          <DivisionCard
            title="Brooding"
            href="/brooding"
            lines={[
              { label: "Birds", value: `${fmtK(birdsIn(brooding))} in ${brooding.stats.length} ${brooding.stats.length === 1 ? "batch" : "batches"}` },
              { label: "Average weight", value: fmtKg(weighted(brooding), 2) },
              { label: "Sent on this month", value: `${fmtK(dispatchedMonth)} birds` },
              { label: "Feed", value: `${fmtBags(Math.max(0, brooding.feed.stockKg), S.feedBagKg)}${brooding.feed.daysCover ? ` · ${brooding.feed.daysCover} days` : ""}`, tone: brooding.feed.daysCover && brooding.feed.daysCover < 7 ? "warn" : undefined },
            ]}
          />
        ) : null}
        {can("ruminants") ? (
          <DivisionCard
            title="Ruminants"
            href="/ruminants"
            lines={[
              { label: "On the farm", value: `${fmtK(herd.length)} animals` },
              { label: "Born this month", value: fmtK(S.animals.filter((a) => a.source === "born" && inMonth(a.joined)).length), tone: "good" },
              { label: "Died or culled this month", value: fmtK(S.animals.filter((a) => (a.status === "died" || a.status === "culled") && inMonth(a.leftOn)).length) },
              { label: "Sold this month", value: fmtK(S.animals.filter((a) => a.status === "sold" && inMonth(a.leftOn)).length) },
            ]}
          />
        ) : null}
        {can("feed") ? (
          <DivisionCard
            title="Feed mill"
            href="/feed"
            lines={[
              { label: "Made this month", value: `${fmtK(madeMonth)} kg` },
              { label: "Finished feed in stock", value: fmtBags(finishedKg, S.feedBagKg) },
              { label: "Requests waiting", value: String(pendingReqs), tone: pendingReqs ? "warn" : undefined },
              { label: "Ingredients low", value: String(lowIngredients.length), tone: lowIngredients.length ? "warn" : undefined },
            ]}
          />
        ) : null}
        {can("money") || can("eggsales") ? (
          <DivisionCard
            title="Money"
            href={can("money") ? "/payments" : "/layers/sales"}
            lines={[
              { label: "Sales this month", value: fmtN(salesMonth) },
              { label: "Collected this month", value: fmtN(collectedMonth), tone: "good" },
              { label: "Owed to the farm", value: fmtN(receivables), tone: receivables ? "warn" : undefined },
              ...(farmNet !== null ? [{ label: "Net this month", value: farmNet < 0 ? `(${fmtN(-farmNet)})` : fmtN(farmNet), tone: (farmNet < 0 ? "bad" : "good") as Line["tone"] }] : []),
            ]}
          />
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="px-5 py-4">
          <CardTitle>Recent activity</CardTitle>
          <div className="mt-3 flex flex-col">
            {acts.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#ebf0ef] py-[9px]">
                <div className="w-[52px] flex-shrink-0 text-xs tabular-nums text-[#84908f]">{fmtD(a.d)}</div>
                <div className="flex-1 text-[13.5px]">{a.text}</div>
                <Badge label={a.tag} bg={toneBg[a.tone]} fg={toneFg[a.tone]} />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="px-5 py-4">
            <CardTitle>Needs attention</CardTitle>
            <div className="mt-2.5">
              {attention.length === 0 ? <div className="py-2 text-[13px] text-[#84908f]">Nothing waiting — all clear.</div> : null}
              {attention.map((a) => (
                <Link key={a.text} href={a.href} className="flex items-center justify-between gap-3 border-b border-[#ebf0ef] py-[7px] text-[13.5px] last:border-0 hover:underline">
                  <span style={{ color: TONE[a.tone] }}>{a.text}</span>
                  <span className="text-[#84908f]">→</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle>Feed on hand</CardTitle>
              <span className="text-[12.5px] text-[#84908f]">{fmtBags(allFeedKg, S.feedBagKg)} in all</span>
            </div>
            <div className="mt-2">
              {can("feed")
                ? finPos.map((p) => (
                    <div key={p.id} className="flex items-baseline justify-between border-b border-[#ebf0ef] py-[7px] text-[13.5px]">
                      <span>
                        {p.name} <span className="text-[12px] text-[#84908f]">at the mill</span>
                      </span>
                      <span className="font-data font-semibold">{fmtK(Math.max(0, p.bags))} bags</span>
                    </div>
                  ))
                : null}
              {feedStores.map((f) => (
                <div key={f.name} className="flex items-baseline justify-between border-b border-[#ebf0ef] py-[7px] text-[13.5px] last:border-0">
                  <span>
                    {f.name} store {f.cover ? <span className="text-[12px] text-[#84908f]">about {f.cover} days</span> : null}
                  </span>
                  <span className="font-data font-semibold">{fmtBags(f.kg, S.feedBagKg)}</span>
                </div>
              ))}
            </div>
          </Card>

          {debtRows.length ? (
            <Card className="px-5 py-4">
              <CardTitle>Blocking debt</CardTitle>
              <div className="mt-2.5">
                {debtRows.map((d) => (
                  <div key={d.name} className="flex items-center justify-between py-[7px]">
                    <div>
                      <div className="text-[13.5px] font-semibold">{d.name}</div>
                      <div className="text-xs text-[#84908f]">{d.sub}</div>
                    </div>
                    <div className="text-[13.5px] font-bold tabular-nums text-[#c7402f]">{d.owed}</div>
                  </div>
                ))}
              </div>
              <Note>Unpaid invoices from before this week block new portal orders.</Note>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
