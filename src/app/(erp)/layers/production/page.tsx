"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, withdrawals } from "@/lib/erp/derive";
import {
  Card,
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
import { DayInput } from "@/components/erp/Drawer";

const fieldLabel =
  "mb-1.5 text-[13px] font-semibold text-[#4c5a51]";
const fieldInput =
  "rounded-[10px] border border-[#dce1da] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#2f8f46] focus:ring-2 focus:ring-[#2f8f46]/15";

export default function LayersProduction() {
  const S = useErp();
  const [day, setDay] = useState("");
  const held = withdrawals(S.vaccinations, S.medications, day || S.today);
  const [picked, setHouse] = useState("");
  const house = useHouse(picked);
  const [eggs, setEggs] = useState("");
  const [cracked, setCracked] = useState("");
  const [rejects, setRejects] = useState("");
  const [msg, setMsg] = useState("");

  const record = async () => {
    const n = Number(eggs);
    const c = cracked.trim() ? Number(cracked) : 0;
    const r = rejects.trim() ? Number(rejects) : 0;
    if (!house) {
      setMsg("Add a house first.");
      return;
    }
    if (!Number.isInteger(n) || n <= 0) {
      setMsg("Enter total eggs first.");
      return;
    }
    if (!Number.isInteger(c) || c < 0 || !Number.isInteger(r) || r < 0) {
      setMsg("Cracked and rejects are whole numbers.");
      return;
    }
    if (c + r > n) {
      setMsg("Cracked + rejects can't exceed total eggs.");
      return;
    }
    if (!(await S.addProduction(house, n, c, r, day || undefined)).ok) return setMsg("");
    setEggs("");
    setCracked("");
    setRejects("");
    setMsg("Recorded ✓");
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Egg production"
        sub="Daily collections, house by house"
      />

      {held.size ? (
        <div className="mb-4 rounded-2xl border border-[#f0cfc9] bg-[#fbeae7] px-4 py-3 text-[14px] text-[#8a2f22]">
          Drug withdrawal{day && day !== S.today ? ` on ${fmtD(day)}` : ""}:{" "}
          {[...held].map(([h, until], i) => (
            <span key={h}>
              {i ? "; " : ""}
              <span className="font-semibold">{h}</span> until {fmtD(until)}
            </span>
          ))}
          . Good eggs from {held.size > 1 ? "these houses" : "this house"} are recorded as withheld and
          can&apos;t be graded or sold.
        </div>
      ) : null}

      <Card className="mb-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>Date</div>
          <DayInput value={day} onChange={setDay} className={fieldInput} />
        </div>
        <div>
          <div className={fieldLabel}>House</div>
          <HouseSelect value={house} onChange={setHouse} className={fieldInput} />
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
        <div>
          <div className={fieldLabel}>Rejects</div>
          <input
            type="number"
            value={rejects}
            onChange={(e) => setRejects(e.target.value)}
            placeholder="0"
            className={`${fieldInput} w-[80px]`}
          />
        </div>
        <button
          onClick={record}
          disabled={S.saving}
          className="rounded-[10px] bg-[#2f8f46] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#27793b] disabled:opacity-50"
        >
          {day && day !== S.today ? `Record collection for ${fmtD(day)}` : "Record today’s collection"}
        </button>
        <div className="ml-auto text-[12.5px] text-[#8b958d]">{msg}</div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>House</Th>
            <Th right>Total eggs</Th>
            <Th right>Cracked</Th>
            <Th right>Rejects</Th>
            <Th right>Withheld</Th>
            <Th right>Sellable</Th>
            <Th right />
          </THead>
          <tbody>
            {S.prodLog.map((p, i) => (
              <TRow key={p.id}>
                <Td>{fmtD(p.date)}</Td>
                <Td className="font-semibold">{p.house}</Td>
                <Td right>{fmtK(p.eggs)}</Td>
                <Td right className="text-[#b57a12]">
                  {p.cracked}
                </Td>
                <Td right className="text-[#c7402f]">
                  {p.rejects}
                </Td>
                <Td right className="text-[#8a2f22]">{p.withheld || "—"}</Td>
                <Td right className="font-semibold">
                  {fmtK(p.eggs - p.cracked - p.rejects - p.withheld)}
                </Td>
                <Td right>
                  <DeleteButton kind="production" id={p.id} what={`the ${fmtD(p.date)} ${p.house} collection`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
