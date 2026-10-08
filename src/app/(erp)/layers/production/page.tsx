"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK } from "@/lib/erp/derive";
import {
  Card,
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

export default function LayersProduction() {
  const S = useErp();
  const [house, setHouse] = useState("H-01");
  const [eggs, setEggs] = useState("");
  const [cracked, setCracked] = useState("");
  const [msg, setMsg] = useState("");

  const record = async () => {
    const n = parseInt(eggs, 10);
    if (!n || n <= 0) {
      setMsg("Enter total eggs first.");
      return;
    }
    if (!(await S.addProduction(house, n, parseInt(cracked, 10) || 0)).ok) return setMsg("");
    setEggs("");
    setCracked("");
    setMsg("Recorded ✓");
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Egg production"
        sub="Daily collections, house by house"
      />

      <Card className="mb-4 flex items-end gap-3 px-4 py-3.5">
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
          <div className={fieldLabel}>Total eggs</div>
          <input
            type="number"
            value={eggs}
            onChange={(e) => setEggs(e.target.value)}
            placeholder="e.g. 2100"
            className={`${fieldInput} w-[110px]`}
          />
        </div>
        <div>
          <div className={fieldLabel}>Cracked</div>
          <input
            type="number"
            value={cracked}
            onChange={(e) => setCracked(e.target.value)}
            placeholder="0"
            className={`${fieldInput} w-[80px]`}
          />
        </div>
        <button
          onClick={record}
          className="rounded-lg bg-[#3c4d28] px-5 py-[9px] text-[13px] font-bold text-white"
        >
          Record today’s collection
        </button>
        <div className="ml-auto text-[12.5px] text-[#8a9070]">{msg}</div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>House</Th>
            <Th right>Total eggs</Th>
            <Th right>Cracked</Th>
            <Th right>Rejects</Th>
            <Th right>Good eggs</Th>
          </THead>
          <tbody>
            {S.prodLog.map((p, i) => (
              <TRow key={i}>
                <Td>{fmtD(p.date)}</Td>
                <Td className="font-semibold">{p.house}</Td>
                <Td right>{fmtK(p.eggs)}</Td>
                <Td right className="text-[#b97a12]">
                  {p.cracked}
                </Td>
                <Td right className="text-[#b3402f]">
                  {p.rejects}
                </Td>
                <Td right className="font-semibold">
                  {fmtK(p.eggs - p.cracked - p.rejects)}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
