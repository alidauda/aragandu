"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK } from "@/lib/erp/derive";
import {
  Card,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

const fieldLabel =
  "mb-[5px] text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]";
const fieldInput =
  "rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-2 text-[13.5px] outline-none";

export default function LayersWater() {
  const S = useErp();
  const [house, setHouse] = useState(S.houses[0]?.code ?? "H-01");
  const [litres, setLitres] = useState("");
  const [msg, setMsg] = useState("");

  const latest = S.waterLogs.reduce((m, w) => (w.date > m ? w.date : m), "");
  const today = S.waterLogs
    .filter((w) => w.date === latest)
    .reduce((a, w) => a + w.litres, 0);
  const days = new Set(S.waterLogs.map((w) => w.date)).size || 1;
  const avg = S.waterLogs.reduce((a, w) => a + w.litres, 0) / days;

  const record = () => {
    const n = parseFloat(litres);
    if (!n || n <= 0) {
      setMsg("Enter litres first.");
      return;
    }
    S.addWaterLog({ house, litres: n });
    setLitres("");
    setMsg("Logged ✓");
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Water"
        sub="Metering, not stock — litres per house"
      />

      <div className="stagger grid grid-cols-4 gap-3.5">
        <Kpi label="Used today" value={`${fmtK(today)} L`} sub="across all houses" />
        <Kpi
          label="Daily average"
          value={`${fmtK(avg)} L`}
          sub="recent logged days"
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
            {S.houses.map((h) => (
              <option key={h.code} value={h.code}>
                {h.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={fieldLabel}>Litres</div>
          <input
            type="number"
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            placeholder="e.g. 1200"
            className={`${fieldInput} font-data w-[110px]`}
          />
        </div>
        <button
          onClick={record}
          className="rounded-lg bg-[#3c4d28] px-5 py-[9px] text-[13px] font-bold text-white"
        >
          Log water
        </button>
        <div className="ml-auto text-[12.5px] text-[#8a9070]">{msg}</div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>House</Th>
            <Th right>Litres</Th>
          </THead>
          <tbody>
            {S.waterLogs.map((w, i) => (
              <TRow key={i}>
                <Td>{fmtD(w.date)}</Td>
                <Td className="font-semibold">{w.house}</Td>
                <Td right>{fmtK(w.litres)}</Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>Water is metering, not stock — a plain log, no ledger.</Note>
    </>
  );
}
