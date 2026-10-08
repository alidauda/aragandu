"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { eggStock, fmtD, fmtK } from "@/lib/erp/derive";
import {
  Badge,
  Card,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
  DeleteButton,
} from "@/components/erp/ui";

const fieldLabel =
  "mb-[5px] text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]";
const fieldInput =
  "rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-2 text-[13.5px] outline-none";

export default function LayersEggInventory() {
  const S = useErp();
  const [type, setType] = useState<"in" | "out">("in");
  const [crates, setCrates] = useState("");
  const [msg, setMsg] = useState("");

  const stock = eggStock(S.eggMoves, S.invoices);
  const soldCrates = S.invoices
    .filter((v) => v.product === "Eggs (crates)")
    .reduce((a, v) => a + v.qty, 0);
  const gradedIn = S.eggMoves
    .filter((m) => m.type === "in")
    .reduce((a, m) => a + m.crates, 0);
  const nonSaleOut = S.eggMoves
    .filter((m) => m.type === "out")
    .reduce((a, m) => a + m.crates, 0);
  const rows = [...S.eggMoves].sort((a, b) => b.date.localeCompare(a.date));

  const record = async () => {
    const n = parseInt(crates, 10);
    if (!n || n <= 0) {
      setMsg("Enter crates first.");
      return;
    }
    if (!(await S.addEggMove(type, n)).ok) return setMsg("");
    setCrates("");
    setMsg("Recorded ✓");
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Egg inventory"
        sub="The crate ledger — sales subtract on their own"
      />

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Kpi
          label="In stock"
          value={`${fmtK(stock)} crates`}
          formula={`${fmtK(gradedIn)} in − ${nonSaleOut} out − ${fmtK(soldCrates)} sold`}
        />
        <Kpi label="Graded in" value={fmtK(gradedIn)} sub="all-time crates in" />
        <Kpi
          label="Sold"
          value={fmtK(soldCrates)}
          sub="crate invoices subtract"
          color="#2f7cb6"
        />
        <Kpi
          label="Non-sale outs"
          value={fmtK(nonSaleOut)}
          sub="spoilage, culls, internal use"
          color="#a06a0e"
        />
      </div>

      <Card className="mb-4 mt-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>Movement</div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "in" | "out")}
            className={fieldInput}
          >
            <option value="in">In — graded into store</option>
            <option value="out">Out — non-sale exit</option>
          </select>
        </div>
        <div>
          <div className={fieldLabel}>Crates</div>
          <input
            type="number"
            value={crates}
            onChange={(e) => setCrates(e.target.value)}
            placeholder="e.g. 120"
            className={`${fieldInput} w-[100px]`}
          />
        </div>
        <button
          onClick={record}
          disabled={S.saving}
          className="rounded-lg bg-[#3c4d28] px-5 py-[9px] text-[13px] font-bold text-white disabled:opacity-50"
        >
          Record movement
        </button>
        <div className="ml-auto text-[12.5px] text-[#8a9070]">{msg}</div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th right>Crates</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.map((m, i) => (
              <TRow key={m.id}>
                <Td>{fmtD(m.date)}</Td>
                <Td>
                  <Badge
                    label={m.type === "in" ? "in" : "out"}
                    bg={m.type === "in" ? "#e8f2e5" : "#fdf3e0"}
                    fg={m.type === "in" ? "#3f6f3a" : "#a06a0e"}
                  />
                </Td>
                <Td right className="font-semibold">
                  {fmtK(m.crates)}
                </Td>
                <Td right>
                  <DeleteButton kind="eggMove" id={m.id} what={`this ${m.type === "in" ? "graded-in" : "out"} movement of ${m.crates} crates`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Stock = graded in − non-sale outs − crates sold. Sales subtract on
        their own from the invoices ledger — never record a dispatch here for
        something that was sold.
      </Note>
    </>
  );
}
