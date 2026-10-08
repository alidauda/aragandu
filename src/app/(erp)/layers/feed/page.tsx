"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, layersFeedPosition } from "@/lib/erp/derive";
import {
  Card,
  CardTitle,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
  HouseSelect,
  useHouse,
  DeleteButton,
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  TextField,
} from "@/components/erp/Drawer";
import { isDivisionBuyer } from "@/lib/erp/divisions";

const fieldLabel =
  "mb-1.5 text-[13px] font-semibold text-[#4c5a51]";
const fieldInput =
  "rounded-[10px] border border-[#dce1da] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#2f8f46] focus:ring-2 focus:ring-[#2f8f46]/15";

export default function LayersFeed() {
  const S = useErp();
  const [picked, setHouse] = useState("");
  const house = useHouse(picked);
  const [kg, setKg] = useState("");
  const [msg, setMsg] = useState("");

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
    const n = parseFloat(kg);
    if (!house) {
      setMsg("Add a house first.");
      return;
    }
    if (!n || n <= 0) {
      setMsg("Enter kg first.");
      return;
    }
    if (!(await S.logFeedUse(house, n)).ok) return setMsg("");
    setKg("");
    setMsg("Logged ✓");
  };

  const [openDeliv, setOpenDeliv] = useState(false);
  const [deliv, setDeliv] = useState({ supplier: "", kg: "" });

  const [delivError, setDelivError] = useState("");

  const saveDeliv = async () => {
    const n = parseFloat(deliv.kg);
    if (!deliv.supplier.trim()) return setDelivError("Enter the supplier.");
    if (!n || n <= 0) return setDelivError("Enter the kg delivered.");
    setDelivError("");
    if (!(await S.addLayersFeedDelivery({ supplier: deliv.supplier.trim(), kg: n })).ok) return setMsg("");
    setDeliv({ supplier: "", kg: "" });
    setOpenDeliv(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Feed"
        sub="External deliveries + mill transfers − consumption"
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
            label="Quantity (kg)"
            type="number"
            value={deliv.kg}
            onChange={(v) => setDeliv({ ...deliv, kg: v })}
            placeholder="3000"
          />
          <div />
        </FieldRow>
        <FormError message={delivError} />
      </Drawer>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Kpi
          label="Feed stock"
          value={`${fmtK(pos.stockKg)} kg`}
          formula={`${fmtK(pos.external)} deliv + ${fmtK(pos.fromMill)} mill − ${fmtK(pos.used)} used`}
          color={pos.stockKg < 0 ? "#c7402f" : "#2f8f46"}
        />
        <Kpi label="Used today" value={`${fmtK(pos.usedToday)} kg`} sub="logged today, all houses" color="#9a6a12" />
        <Kpi label="Days cover" value={String(pos.daysCover)} sub="at the last 7 days' pace" />
        <Kpi
          label="From mill"
          value={`${fmtK(pos.fromMill)} kg`}
          sub="internal feed sales to Layers"
          color="#3a8bd6"
        />
      </div>

      <Card className="mb-4 mt-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>House</div>
          <HouseSelect value={house} onChange={setHouse} className={fieldInput} />
        </div>
        <div>
          <div className={fieldLabel}>Feed used (kg)</div>
          <input
            type="number"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="e.g. 260"
            className={`${fieldInput} w-[110px]`}
          />
        </div>
        <button
          onClick={record}
          disabled={S.saving}
          className="rounded-[10px] bg-[#2f8f46] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#27793b] disabled:opacity-50"
        >
          Log feed use
        </button>
        <div className="ml-auto text-[12.5px] text-[#8b958d]">{msg}</div>
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
                <Th right>Kg</Th>
                <Th right />
              </THead>
              <tbody>
                {useRows.map((u, i) => (
                  <TRow key={u.id}>
                    <Td>{fmtD(u.date)}</Td>
                    <Td className="font-semibold">{u.house}</Td>
                    <Td right>{fmtK(u.kg)}</Td>
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
                      <Td>{fmtD(s.date)}</Td>
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
                  <Th right>Kg</Th>
                  <Th right />
                </THead>
                <tbody>
                  {S.layersFeedDeliveries.map((d) => (
                    <TRow key={d.id}>
                      <Td>{fmtD(d.date)}</Td>
                      <Td>{d.supplier}</Td>
                      <Td right>{fmtK(d.kg)}</Td>
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
        Stock = external deliveries + the mill&apos;s internal sales to Layers −
        consumption. The mill transfers aren&apos;t re-entered here — they come
        from the feed sales ledger.
      </Note>
    </>
  );
}
