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
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  NewButton,
  TextField,
} from "@/components/erp/Drawer";

const fieldLabel =
  "mb-[5px] text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]";
const fieldInput =
  "rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-2 text-[13.5px] outline-none";

export default function LayersFeed() {
  const S = useErp();
  const [house, setHouse] = useState("H-01");
  const [kg, setKg] = useState("");
  const [msg, setMsg] = useState("");

  const pos = layersFeedPosition(S.layersFeedDeliveries, S.feedSales, S.products, S.feedUse);
  const useRows = [...S.feedUse].sort((a, b) => b.date.localeCompare(a.date));
  const millRows = S.feedSales
    .filter((s) => s.channel === "internal" && s.buyer === "Layers")
    .sort((a, b) => b.date.localeCompare(a.date));

  const record = () => {
    const n = parseFloat(kg);
    if (!n || n <= 0) {
      setMsg("Enter kg first.");
      return;
    }
    S.logFeedUse(house, n);
    setKg("");
    setMsg("Logged ✓");
  };

  const [openDeliv, setOpenDeliv] = useState(false);
  const [deliv, setDeliv] = useState({ supplier: "", kg: "" });

  const saveDeliv = () => {
    const n = parseFloat(deliv.kg);
    if (!n || n <= 0 || !deliv.supplier.trim()) return;
    S.addLayersFeedDelivery({ supplier: deliv.supplier.trim(), kg: n });
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
      </Drawer>

      <div className="stagger grid grid-cols-4 gap-3.5">
        <Kpi
          label="Feed stock"
          value={`${fmtK(pos.stockKg)} kg`}
          formula={`${fmtK(pos.external)} deliv + ${fmtK(pos.fromMill)} mill − ${fmtK(pos.used)} used`}
          color={pos.stockKg < 0 ? "#b3402f" : "#3c4d28"}
        />
        <Kpi label="Used today" value={`${fmtK(pos.usedToday)} kg`} sub="latest logged day" color="#a06a0e" />
        <Kpi label="Days cover" value={String(pos.daysCover)} sub="at recent daily average" />
        <Kpi
          label="From mill"
          value={`${fmtK(pos.fromMill)} kg`}
          sub="internal feed sales to Layers"
          color="#2f7cb6"
        />
      </div>

      <Card className="mb-4 mt-4 flex items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>House</div>
          <select
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            className={fieldInput}
          >
            <option value="H-01">H-01</option>
            <option value="H-02">H-02</option>
            <option value="H-03">H-03</option>
          </select>
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
          className="rounded-lg bg-[#3c4d28] px-5 py-[9px] text-[13px] font-bold text-white"
        >
          Log feed use
        </button>
        <div className="ml-auto text-[12.5px] text-[#8a9070]">{msg}</div>
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
              </THead>
              <tbody>
                {useRows.map((u, i) => (
                  <TRow key={i}>
                    <Td>{fmtD(u.date)}</Td>
                    <Td className="font-semibold">{u.house}</Td>
                    <Td right>{fmtK(u.kg)}</Td>
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
                      <Td right>{fmtK(s.bags * 25)}</Td>
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
                </THead>
                <tbody>
                  {S.layersFeedDeliveries.map((d) => (
                    <TRow key={d.id}>
                      <Td>{fmtD(d.date)}</Td>
                      <Td>{d.supplier}</Td>
                      <Td right>{fmtK(d.kg)}</Td>
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
