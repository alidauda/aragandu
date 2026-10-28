"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { monthName } from "@/lib/dates";
import { feedCostPerCrate, fmtBags, fmtD, fmtK, fmtN, layersFeedPosition } from "@/lib/erp/derive";
import {
  Card,
  CardTitle,
  DeleteButton,
  HouseSelect,
  Kpi,
  Note,
  PageHeader,
  Recorded,
  Table,
  Td,
  Th,
  THead,
  TRow,
  useHouse,
} from "@/components/erp/ui";
import {
  DayField,
  DayInput,
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  TextField,
} from "@/components/erp/Drawer";
import { isDivisionBuyer } from "@/lib/erp/divisions";

const fieldLabel =
  "mb-1.5 text-[13px] font-semibold text-[#465657]";
const fieldInput =
  "rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";

export default function LayersFeed() {
  const S = useErp();
  const [picked, setHouse] = useState("");
  const house = useHouse(picked);
  // Layers count feed in bags; it's kept as kg (bags × the bag size in Settings).
  const bagKg = S.feedBagKg;
  const bags = (kg: number) => fmtBags(kg, bagKg);
  const [count, setCount] = useState("");
  const [msg, setMsg] = useState("");
  const [day, setDay] = useState("");

  const monthStart = S.today.slice(0, 8) + "01";
  const cost = feedCostPerCrate(
    {
      external: S.layersFeedDeliveries,
      feedSales: S.feedSales,
      products: S.products,
      feedUse: S.feedUse,
      moves: S.eggMoves,
    },
    monthStart,
    S.today
  );
  const pos = layersFeedPosition(
    S.layersFeedDeliveries,
    S.feedSales,
    S.products,
    S.feedUse,
    S.today
  );
  const useRows = [...S.feedUse].sort((a, b) => b.date.localeCompare(a.date));
  const millRows = S.feedSales
    .filter((s) => s.channel === "internal" && isDivisionBuyer(s.buyer, "layers"))
    .sort((a, b) => b.date.localeCompare(a.date));

  const record = async () => {
    const n = parseFloat(count);
    if (!house) {
      setMsg("Add a house first.");
      return;
    }
    if (!n || n <= 0) {
      setMsg("Enter the bags used first.");
      return;
    }
    if (!(await S.logFeedUse(house, n * bagKg, day || undefined)).ok) return setMsg("");
    setCount("");
    setMsg("Logged ✓");
  };

  const [openDeliv, setOpenDeliv] = useState(false);
  const [deliv, setDeliv] = useState({ supplier: "", bags: "", price: "", date: "" });

  const [delivError, setDelivError] = useState("");

  const saveDeliv = async () => {
    const n = parseFloat(deliv.bags);
    if (!deliv.supplier.trim()) return setDelivError("Enter the supplier.");
    if (!n || n <= 0) return setDelivError("Enter the bags delivered.");
    const price = Number(deliv.price);
    if (!(price > 0)) return setDelivError("Enter the price per bag — it's how feed cost per crate is worked out.");
    setDelivError("");
    const r = await S.addLayersFeedDelivery({
      supplier: deliv.supplier.trim(),
      kg: n * bagKg,
      pricePerKg: price / bagKg,
      date: deliv.date || undefined,
    });
    if (!r.ok) return;
    setDeliv({ supplier: "", bags: "", price: "", date: "" });
    setOpenDeliv(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Feed"
        sub="Feed bought in and from the mill, less what the houses used"
        action={
          <NewButton onClick={() => setOpenDeliv(true)}>
            Record delivery
          </NewButton>
        }
      />
      <Drawer
        open={openDeliv}
        onClose={() => setOpenDeliv(false)}
        title="Record external delivery"
        sub="Feed bought outside — the mill's transfers arrive on their own"
        onSubmit={saveDeliv}
        submitLabel="Record delivery"
      >
        <TextField
          label="Supplier"
          value={deliv.supplier}
          onChange={(v) => setDeliv({ ...deliv, supplier: v })}
          placeholder="AgroFeeds Ltd"
        />
        <FieldRow>
          <TextField
            label={`Bags (${bagKg} kg)`}
            type="number"
            value={deliv.bags}
            onChange={(v) => setDeliv({ ...deliv, bags: v })}
            placeholder="120"
          />
          <TextField
            label="Price per bag ₦"
            type="number"
            value={deliv.price}
            onChange={(v) => setDeliv({ ...deliv, price: v })}
            placeholder="14500"
          />
        </FieldRow>
        {Number(deliv.bags) > 0 ? (
          <div className="-mt-1 text-[12.5px] text-[#84908f]">
            {fmtK(Number(deliv.bags) * bagKg)} kg
            {Number(deliv.price) > 0 ? ` · ${fmtN(Number(deliv.bags) * Number(deliv.price))} in all` : ""}
          </div>
        ) : null}
        <DayField label="Delivered on" value={deliv.date} onChange={(v) => setDeliv({ ...deliv, date: v })} />
        <FormError message={delivError} />
      </Drawer>

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Feed stock"
          value={bags(pos.stockKg)}
          formula={`${bags(pos.external)} bought + ${bags(pos.fromMill)} mill − ${bags(pos.used)} used · ${fmtK(pos.stockKg)} kg`}
          color={pos.stockKg < 0 ? "#c7402f" : "#055a5b"}
        />
        <Kpi label="Used today" value={bags(pos.usedToday)} sub={`${fmtK(pos.usedToday)} kg, all houses`} color="#9a6a12" />
        <Kpi label="Days cover" value={String(pos.daysCover)} sub="at the last 7 days' pace" />
        <Kpi
          label={`Feed cost per crate — ${monthName(S.today)}`}
          value={cost.perCrate ? fmtN(cost.perCrate) : "—"}
          sub={
            cost.crates
              ? `${bags(cost.used)} at ${fmtN(cost.perKg * bagKg)}/bag ÷ ${fmtK(cost.crates)} crates graded`
              : "No crates graded this month yet"
          }
          color="#055a5b"
        />
        <Kpi
          label="From mill"
          value={bags(pos.fromMill)}
          sub="sent by the feed mill"
          color="#3a8bd6"
        />
      </div>

      <Card className="mb-4 mt-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>Date</div>
          <DayInput value={day} onChange={setDay} className={fieldInput} />
        </div>
        <div>
          <div className={fieldLabel}>House</div>
          <HouseSelect value={house} onChange={setHouse} className={fieldInput} />
        </div>
        <div>
          <div className={fieldLabel}>Feed used (bags)</div>
          <input
            type="number"
            step="0.5"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="e.g. 10"
            className={`${fieldInput} w-[110px]`}
          />
        </div>
        <button
          onClick={record}
          disabled={S.saving}
          className="rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#044647] disabled:opacity-50"
        >
          Log feed use
        </button>
        <div className="ml-auto text-[12.5px] text-[#84908f]">{msg}</div>
      </Card>

      <div className="stagger grid grid-cols-2 gap-3.5">
        <Card className="overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>Consumption log</CardTitle>
          </div>
          <div className="mt-2">
            <Table>
              <THead>
                <Th>Date</Th>
                <Th>House</Th>
                <Th right>Bags</Th>
                <Th right />
              </THead>
              <tbody>
                {useRows.map((u, i) => (
                  <TRow key={u.id}>
                    <Td>
                      {fmtD(u.date)}
                      <Recorded at={u.createdAt} date={u.date} />
                    </Td>
                    <Td className="font-semibold">{u.house}</Td>
                    <Td right>
                      {bags(u.kg)}
                      <div className="text-[11.5px] text-[#84908f]">{fmtK(u.kg)} kg</div>
                    </Td>
                    <Td right>
                      <DeleteButton kind="feedUse" id={u.id} what={`the ${fmtD(u.date)} ${u.house} feed entry`} />
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="overflow-hidden">
            <div className="px-4 pt-3.5">
              <CardTitle>From the mill</CardTitle>
            </div>
            <div className="mt-2">
              <Table>
                <THead>
                  <Th>Date</Th>
                  <Th right>Bags</Th>
                  <Th right>Kg</Th>
                </THead>
                <tbody>
                  {millRows.map((s) => (
                    <TRow key={s.id}>
                      <Td>
                        {fmtD(s.date)}
                        <Recorded at={s.createdAt} date={s.date} />
                      </Td>
                      <Td right>{s.bags}</Td>
                      <Td right>
                        {fmtK(s.bags * (S.products.find((p) => p.id === s.product)?.bag ?? 0))}
                      </Td>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 pt-3.5">
              <CardTitle>External deliveries</CardTitle>
            </div>
            <div className="mt-2">
              <Table>
                <THead>
                  <Th>Date</Th>
                  <Th>Supplier</Th>
                  <Th right>Bags</Th>
                  <Th right>₦/bag</Th>
                  <Th right />
                </THead>
                <tbody>
                  {S.layersFeedDeliveries.map((d) => (
                    <TRow key={d.id}>
                      <Td>
                        {fmtD(d.date)}
                        <Recorded at={d.createdAt} date={d.date} />
                      </Td>
                      <Td>{d.supplier}</Td>
                      <Td right>
                        {bags(d.kg)}
                        <div className="text-[11.5px] text-[#84908f]">{fmtK(d.kg)} kg</div>
                      </Td>
                      <Td right>{d.pricePerKg ? fmtN(d.pricePerKg * bagKg) : "—"}</Td>
                      <Td right>
                        <DeleteButton kind="layersFeedDelivery" id={d.id} what={`the ${fmtD(d.date)} delivery from ${d.supplier}`} />
                      </Td>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
      <Note>
        Feed is counted in bags of {bagKg} kg (the bag size is in Settings). Stock = bags bought in + bags sent by
        the mill − bags used. The mill&apos;s transfers aren&apos;t re-entered here — they come from the feed sales
        ledger.
      </Note>
    </>
  );
}
