"use client";

import { useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { monthName } from "@/lib/dates";
import { fmtAge, fmtEggs, fmtK, fmtN } from "@/lib/erp/derive";
import { divisionSummary, fmtKobo, monthlySummary } from "@/lib/erp/finance";
import { useErp } from "@/lib/erp/store";
import { FinanceTabs, MonthSelect } from "@/components/erp/FinanceTabs";
import { Card, CardTitle, Kpi, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

const input = "w-[120px] rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#055a5b]";
type Summary = ReturnType<typeof monthlySummary>;
type Flock = Summary["laying"][number];

const moneyColor = (n: number) => (n < 0 ? "#c7402f" : "#016559");
const net = (n: number) => (n < 0 ? `(${fmtN(-n)})` : fmtN(n));

const Sub = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11.5px] text-[#84908f]">{children}</div>
);

function FlockHead() {
  return (
    <THead>
      <Th>Focus</Th>
      <Th right>Birds</Th>
      <Th right>Age</Th>
      <Th right>Crates</Th>
      <Th right>Egg sales</Th>
      <Th right>Manure bags</Th>
      <Th right>Manure sales</Th>
      <Th right>Total sales</Th>
      <Th right>Cost of feed</Th>
      <Th right>Net</Th>
    </THead>
  );
}

function FlockRow({ f }: { f: Flock }) {
  return (
    <TRow>
      <Td>
        <span className="font-semibold">{f.batch}</span>
        <div className="text-[12px] text-[#84908f]">{f.breed}</div>
      </Td>
      <Td right>{fmtK(f.birds)}</Td>
      <Td right>{f.ageDays === null ? "—" : fmtAge(f.ageDays)}</Td>
      <Td right>{fmtK(Math.round(f.crates))}</Td>
      <Td right>{fmtN(f.eggSales)}</Td>
      <Td right>
        {fmtK(f.manure.made)}
        <Sub>C/F {fmtK(f.manure.cf)}</Sub>
      </Td>
      <Td right>{fmtN(f.manure.sales)}</Td>
      <Td right className="font-semibold">
        {fmtN(f.totalSales)}
      </Td>
      <Td right>
        {fmtN(f.feedCost)}
        <Sub>{fmtK(Math.round(f.bags * 10) / 10)} bags</Sub>
      </Td>
      <Td right className="font-semibold">
        <span style={{ color: moneyColor(f.net) }}>{net(f.net)}</span>
      </Td>
    </TRow>
  );
}

/** A line under the flocks, such as culls: only its money columns are filled. */
function IncomeRow({ label, amount, bags }: { label: string; amount: number; bags?: { made: number; cf: number } }) {
  return (
    <TRow>
      <Td>{label}</Td>
      <Td right>—</Td>
      <Td right>—</Td>
      <Td right>—</Td>
      <Td right>—</Td>
      <Td right>
        {bags ? fmtK(bags.made) : "—"}
        {bags ? <Sub>C/F {fmtK(bags.cf)}</Sub> : null}
      </Td>
      <Td right>{bags ? fmtN(amount) : "—"}</Td>
      <Td right className="font-semibold">
        {fmtN(amount)}
      </Td>
      <Td right>—</Td>
      <Td right>{amount ? fmtN(amount) : "—"}</Td>
    </TRow>
  );
}

function CostLines({ lines, title, children }: { lines: Summary["farmCosts"]; title: string; children: React.ReactNode }) {
  const paged = usePaged(lines);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="px-4 pt-3.5">
        <CardTitle>{title}</CardTitle>
      </div>
      <div className="mt-2">
        <Table pager={paged.pager}>
          <THead>
            <Th>Item</Th>
            <Th right>Amount</Th>
          </THead>
          <tbody>
            {paged.rows.map((l) => (
              <TRow key={l.label}>
                <Td>{l.label}</Td>
                <Td right>{fmtKobo(l.amount)}</Td>
              </TRow>
            ))}
            {children}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

/** Broilers, Brooding and Ruminants for the month, and the whole farm's net. */
function DivisionCard({
  divs,
  farmNet,
  bagKg,
  label,
}: {
  divs: ReturnType<typeof divisionSummary>;
  farmNet: number;
  bagKg: number;
  label: string;
}) {
  const paged = usePaged(divs.rows);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="px-4 pt-3.5">
        <CardTitle>Other divisions</CardTitle>
      </div>
      <div className="mt-2">
        <Table pager={paged.pager}>
          <THead>
            <Th>Division</Th>
            <Th right>Sales</Th>
            <Th right>Cost of feed</Th>
            <Th right>Expenses</Th>
            <Th right>Net</Th>
          </THead>
          <tbody>
            {paged.rows.map((r) => (
              <TRow key={r.unit}>
                <Td className="font-semibold">{r.label}</Td>
                <Td right>{fmtN(r.sales)}</Td>
                <Td right>
                  {fmtN(r.feedCost)}
                  <Sub>
                    {fmtK(Math.round((r.feedKg / bagKg) * 10) / 10)} bags{r.perKg ? ` at ${fmtN(r.perKg * bagKg)}` : ""}
                  </Sub>
                </Td>
                <Td right>{fmtKobo(r.expenses)}</Td>
                <Td right className="font-semibold">
                  <span style={{ color: moneyColor(r.net) }}>{net(r.net)}</span>
                </Td>
              </TRow>
            ))}
            <TRow>
              <Td className="font-semibold">Whole farm, {label}</Td>
              <Td right>—</Td>
              <Td right>—</Td>
              <Td right>—</Td>
              <Td right className="font-semibold">
                <span style={{ color: moneyColor(farmNet) }}>{net(farmNet)}</span>
              </Td>
            </TRow>
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

/** The farm's monthly summary, one line per focus, as the finance manager draws it up. */
export default function FinanceSummary() {
  const S = useErp();
  const [month, setMonth] = useState(S.today.slice(0, 7));
  const s = monthlySummary(S, month);
  const divs = divisionSummary(S, month);
  const farmNet = s.totals.net + (s.growing.length ? s.growers.net : 0) + divs.total.net;
  const per = S.eggsPerCrate;
  const label = `${monthName(`${month}-01`)} ${month.slice(0, 4)}`;
  const flockPage = usePaged(s.laying, month);
  const growerPage = usePaged(s.growing, month);

  const canEdit = S.canDo("finance", "admin");
  const [edit, setEdit] = useState<{ month: string; layer: string; grower: string } | null>(null);
  const prices = edit?.month === month ? edit : { month, layer: s.price.saved ? String(s.price.layer) : "", grower: s.price.saved ? String(s.price.grower) : "" };
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const savePrices = async () => {
    const layerBag = Number(prices.layer);
    const growerBag = Number(prices.grower);
    if (!(layerBag > 0) || !(growerBag > 0)) return setMsg({ ok: false, text: "Enter both feed prices." });
    const r = await S.setFinanceMonth({ month, layerBag: Math.round(layerBag), growerBag: Math.round(growerBag) });
    setMsg(r.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: r.error });
    if (r.ok) setEdit(null);
  };

  const exportCsv = () => {
    const line = (flock: string, o: Record<string, string | number> = {}) => ({
      flock,
      birds: "",
      age: "",
      eggs: "",
      collected: "",
      egg_sales: "",
      manure_bf: "",
      manure_made: "",
      manure_sum: "",
      manure_sales: "",
      manure_cf: "",
      total_sales: "",
      feed_bags: "",
      cost: "",
      net: "",
      ...o,
    });
    const flock = (f: Flock) =>
      line(f.batch, {
        birds: f.birds,
        age: f.ageDays === null ? "" : fmtAge(f.ageDays),
        eggs: f.good,
        collected: fmtEggs(f.good, per),
        egg_sales: Math.round(f.eggSales),
        manure_bf: f.manure.bf,
        manure_made: f.manure.made,
        manure_sum: f.manure.total,
        manure_sales: f.manure.sales,
        manure_cf: f.manure.cf,
        total_sales: Math.round(f.totalSales),
        feed_bags: f.bags,
        cost: Math.round(f.feedCost),
        net: Math.round(f.net),
      });
    downloadCsv(`argandu-summary-${month}.csv`, [
      ...s.laying.map(flock),
      line("Reserve manure", { manure_bf: s.reserve.bf, manure_made: s.reserve.made, manure_sum: s.reserve.total, manure_sales: s.reserve.sales, manure_cf: s.reserve.cf, total_sales: s.reserve.sales }),
      line("Cull birds", { total_sales: s.cullIncome }),
      line("Cracked eggs", { total_sales: s.crackedIncome }),
      ...s.otherIncome.map((l) => line(l.label, { total_sales: l.amount })),
      line("Sub total", { total_sales: Math.round(s.totals.sales), cost: Math.round(s.totals.feedCost), net: Math.round(s.totals.subtotalNet) }),
      ...s.farmCosts.map((l) => line(l.label, { cost: l.amount })),
      line("Grand total", { total_sales: Math.round(s.totals.sales), cost: s.totals.costs, net: s.totals.net }),
      ...s.growing.map(flock),
      ...s.growerCosts.map((l) => line(l.label, { cost: l.amount })),
      ...(s.growing.length ? [line("Growing birds total", { cost: s.growers.costs, net: s.growers.net })] : []),
      ...divs.rows.map((r) =>
        line(r.label, { total_sales: Math.round(r.sales), feed_bags: Math.round((r.feedKg / S.feedBagKg) * 10) / 10, cost: Math.round(r.feedCost + r.expenses), net: Math.round(r.net) })
      ),
      line("Whole farm", { net: Math.round(farmNet) }),
    ]);
  };

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Monthly summary"
        sub="Each focus's sales less its feed, then the farm's other costs"
        action={
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
          >
            Download CSV
          </button>
        }
      />
      <FinanceTabs />

      <Card className="mb-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <label>
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Month</div>
          <MonthSelect today={S.today} value={month} onChange={(m) => { setMonth(m); setMsg(null); }} />
        </label>
        <label>
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Layers feed ₦/bag</div>
          <input
            type="number"
            disabled={!canEdit}
            value={prices.layer}
            onChange={(e) => setEdit({ ...prices, layer: e.target.value })}
            placeholder={String(s.price.layer || "")}
            className={input}
          />
        </label>
        <label>
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Growers feed ₦/bag</div>
          <input
            type="number"
            disabled={!canEdit}
            value={prices.grower}
            onChange={(e) => setEdit({ ...prices, grower: e.target.value })}
            placeholder={String(s.price.grower || "")}
            className={input}
          />
        </label>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void savePrices()}
            disabled={S.saving}
            className="rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            Save prices
          </button>
        ) : null}
        {msg ? (
          <span className={`text-[13.5px] font-semibold ${msg.ok ? "text-[#016559]" : "text-[#c7402f]"}`}>{msg.text}</span>
        ) : !s.price.saved ? (
          <span className="text-[13px] text-[#9a6a12]">No price saved for {label}: using the average cost of feed received.</span>
        ) : null}
      </Card>

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total sales" value={fmtN(s.totals.sales)} sub={label} color="#055a5b" />
        <Kpi label="Cost of feed" value={fmtN(s.totals.feedCost)} sub={`at ${fmtN(s.price.layer)} a bag`} />
        <Kpi label="Other costs" value={fmtN(s.totals.sharedCost)} sub="salary, running, other" color="#9a6a12" />
        <Kpi label="Net" value={net(s.totals.net)} sub="after every cost" color={moneyColor(s.totals.net)} />
      </div>

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={flockPage.pager}>
          <FlockHead />
          <tbody>
            {s.laying.length === 0 ? (
              <TRow>
                <Td colSpan={10} className="text-[#84908f]">
                  No laying flocks in {label}.
                </Td>
              </TRow>
            ) : null}
            {flockPage.rows.map((f) => (
              <FlockRow key={f.batch} f={f} />
            ))}
            {s.reserve.total ? <IncomeRow label="Reserve manure" amount={s.reserve.sales} bags={s.reserve} /> : null}
            {s.cullIncome ? <IncomeRow label="Cull birds" amount={s.cullIncome} /> : null}
            {s.crackedIncome ? <IncomeRow label="Cracked eggs" amount={s.crackedIncome} /> : null}
            {s.otherIncome.map((l) => (
              <IncomeRow key={l.label} label={l.label} amount={l.amount} />
            ))}
            <TRow>
              <Td className="font-semibold">Sub total</Td>
              <Td right>{fmtK(s.laying.reduce((a, f) => a + f.birds, 0))}</Td>
              <Td right>—</Td>
              <Td right>{fmtK(Math.round(s.laying.reduce((a, f) => a + f.crates, 0)))}</Td>
              <Td right>{fmtN(s.laying.reduce((a, f) => a + f.eggSales, 0))}</Td>
              <Td right>
                {fmtK(s.laying.reduce((a, f) => a + f.manure.made, 0) + s.reserve.made)}
                <Sub>C/F {fmtK(s.laying.reduce((a, f) => a + f.manure.cf, 0) + s.reserve.cf)}</Sub>
              </Td>
              <Td right>{fmtN(s.laying.reduce((a, f) => a + f.manure.sales, 0) + s.reserve.sales)}</Td>
              <Td right className="font-semibold">
                {fmtN(s.totals.sales)}
              </Td>
              <Td right>
                {fmtN(s.totals.feedCost)}
                <Sub>{fmtK(Math.round(s.laying.reduce((a, f) => a + f.bags, 0) * 10) / 10)} bags</Sub>
              </Td>
              <Td right className="font-semibold">
                <span style={{ color: moneyColor(s.totals.subtotalNet) }}>{net(s.totals.subtotalNet)}</span>
              </Td>
            </TRow>
          </tbody>
        </Table>
      </Card>

      <CostLines lines={s.farmCosts} title="Other costs">
        <TRow>
          <Td className="font-semibold">Total cost, with feed</Td>
          <Td right className="font-semibold">
            {fmtKobo(s.totals.costs)}
          </Td>
        </TRow>
        <TRow>
          <Td className="font-semibold">Net for {label}</Td>
          <Td right className="font-semibold">
            <span style={{ color: moneyColor(s.totals.net) }}>{net(s.totals.net)}</span>
          </Td>
        </TRow>
      </CostLines>

      {s.growing.length ? (
        <>
          <Card className="mt-4 overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
            <div className="px-4 pt-3.5">
              <CardTitle>Growing birds</CardTitle>
            </div>
            <div className="mt-2">
              <Table pager={growerPage.pager}>
                <FlockHead />
                <tbody>
                  {growerPage.rows.map((f) => (
                    <FlockRow key={f.batch} f={f} />
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
          <CostLines lines={s.growerCosts} title="Costs of growing birds">
            <TRow>
              <Td className="font-semibold">Total cost, with feed</Td>
              <Td right className="font-semibold">
                {fmtKobo(s.growers.costs)}
              </Td>
            </TRow>
            <TRow>
              <Td className="font-semibold">Net</Td>
              <Td right className="font-semibold">
                <span style={{ color: moneyColor(s.growers.net) }}>{net(s.growers.net)}</span>
              </Td>
            </TRow>
          </CostLines>
        </>
      ) : null}

      <DivisionCard divs={divs} farmNet={farmNet} bagKg={S.feedBagKg} label={label} />

      {s.unlinked.eggs || s.unlinked.bags ? (
        <p className="mt-3 rounded-xl bg-[#fcf2de] px-4 py-2.5 text-[13.5px] text-[#7a5410]">
          Not linked to a flock in {label}, so not in the figures above: {fmtEggs(s.unlinked.eggs, per)} ·{" "}
          {fmtK(Math.round(s.unlinked.bags * 10) / 10)} bags of feed.
        </p>
      ) : null}

      <Note>
        {s.cratesSold
          ? `${fmtK(s.cratesSold)} crates sold in ${label} for ${fmtN(s.actualEggSales)}, an average of ${fmtN(s.cratePrice)} a crate.`
          : `No crates sold in ${label}, so eggs use the crate price of ${fmtN(s.cratePrice)}.`}{" "}
        Other divisions&apos; feed is costed at the average price of the feed each received; birds Brooding sends to Layers or
        Broilers move inside the farm, so they aren&apos;t sales. Each focus&apos;s egg sales are its good crates × that price, so the total differs from actual sales when crates
        go into or come out of store. A focus counts as growing until its laying date is set on Batches. Costs against
        a laying focus show under Other costs.
      </Note>
    </>
  );
}
