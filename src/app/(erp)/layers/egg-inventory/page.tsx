"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import {
  dailyGoodEggs,
  eggStock,
  fmtD,
  fmtK,
  ungradedEggs,
  writeOffShare,
} from "@/lib/erp/derive";
import {
  Badge,
  Card,
  CardTitle,
  DeleteButton,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

const fieldLabel = "mb-1.5 text-[13px] font-semibold text-[#4c5a51]";
const fieldInput =
  "rounded-[10px] border border-[#dce1da] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#2f8f46] focus:ring-2 focus:ring-[#2f8f46]/15";

const OUT_REASONS = ["Breakage", "Spoilage", "Farm use", "Other"];
const OPENING = "opening stock";

export default function LayersEggInventory() {
  const S = useErp();
  const [kind, setKind] = useState<"in" | "out" | "opening">("in");
  const [crates, setCrates] = useState("");
  const [reason, setReason] = useState(OUT_REASONS[0]);
  const [other, setOther] = useState("");
  const [msg, setMsg] = useState("");

  const ok = S.eggMoves.filter((m) => m.status === "approved");
  const stock = eggStock(S.eggMoves, S.invoices);
  const soldCrates = S.invoices
    .filter((v) => v.product === "Eggs (crates)")
    .reduce((a, v) => a + v.qty, 0);
  const gradedIn = ok.filter((m) => m.type === "in").reduce((a, m) => a + m.crates, 0);
  const nonSaleOut = ok.filter((m) => m.type === "out").reduce((a, m) => a + m.crates, 0);
  const ungraded = ungradedEggs(S.prodLog, S.eggMoves, S.eggsPerCrate);
  const perDay = dailyGoodEggs(S.prodLog, S.today);
  // More than ~two days' laying sitting unpacked is worth a look.
  const ungradedHigh = perDay > 0 && ungraded > perDay * 2;
  const share = writeOffShare(S.eggMoves);
  const pending = S.eggMoves.filter((m) => m.status === "pending");
  const rows = [...S.eggMoves].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const record = async () => {
    const n = Number(crates);
    if (!Number.isInteger(n) || n <= 0) return setMsg("Enter a whole number of crates.");
    const why =
      kind === "opening" ? OPENING : kind === "out" ? (reason === "Other" ? other.trim() : reason) : "";
    if (kind === "out" && !why) return setMsg("Say why the crates left.");
    const r = await S.addEggMove(kind === "out" ? "out" : "in", n, why);
    if (!r.ok) return setMsg("");
    setCrates("");
    setOther("");
    setMsg("Recorded ✓");
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Egg inventory"
        sub="Crates on the shelf — graded in from collections, out by sale or write-off"
      />

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="In stock"
          value={`${fmtK(stock)} crates`}
          formula={`${fmtK(gradedIn)} in − ${nonSaleOut} out − ${fmtK(soldCrates)} sold`}
        />
        <Kpi
          label="Eggs not yet graded"
          value={fmtK(ungraded)}
          sub={
            ungradedHigh
              ? `More than two days' laying — check collections against crates (${S.eggsPerCrate} a crate)`
              : `Good eggs collected, not packed (${S.eggsPerCrate} a crate)`
          }
          color={ungradedHigh || ungraded < 0 ? "#c7402f" : "#14231a"}
        />
        <Kpi label="Sold" value={fmtK(soldCrates)} sub="crate invoices subtract" color="#3a8bd6" />
        <Kpi
          label="Written off"
          value={fmtK(nonSaleOut)}
          sub={`${(share * 100).toFixed(1)}% of crates graded in`}
          color={share > 0.03 ? "#c7402f" : "#9a6a12"}
        />
      </div>

      {pending.length ? (
        <Card className="mt-4 px-5 py-4">
          <CardTitle>Write-offs waiting for approval</CardTitle>
          <div className="mt-2 flex flex-col">
            {pending.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ec] py-2.5 text-[14px]"
              >
                <span>
                  {fmtD(m.date)} · <span className="font-semibold">{m.crates} crates</span> · {m.reason} ·
                  by {m.requestedBy}
                </span>
                {S.isAdmin ? (
                  <span className="flex gap-2">
                    <button
                      onClick={() => void S.reviewEggMove(m.id, true)}
                      disabled={S.saving}
                      className="rounded-[10px] bg-[#2f8f46] px-3 py-1.5 text-[12.5px] font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void S.reviewEggMove(m.id, false)}
                      disabled={S.saving}
                      className="rounded-[10px] border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a]"
                    >
                      Reject
                    </button>
                  </span>
                ) : (
                  <span className="text-[12.5px] text-[#8b958d]">awaiting an admin</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="mb-4 mt-4 flex flex-wrap items-end gap-3 px-4 py-3.5">
        <div>
          <div className={fieldLabel}>Movement</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "in" | "out" | "opening")}
            className={fieldInput}
          >
            <option value="in">In — graded from collections</option>
            <option value="out">Out — not a sale</option>
            {S.isAdmin ? <option value="opening">Opening stock (admin)</option> : null}
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
        {kind === "out" ? (
          <>
            <div>
              <div className={fieldLabel}>Reason</div>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldInput}>
                {OUT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            {reason === "Other" ? (
              <div>
                <div className={fieldLabel}>Say what happened</div>
                <input
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  placeholder="Given to the vet"
                  className={`${fieldInput} w-[200px]`}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <button
          onClick={record}
          disabled={S.saving}
          className="rounded-[10px] bg-[#2f8f46] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#27793b] disabled:opacity-50"
        >
          Record movement
        </button>
        <div className="ml-auto text-[12.5px] text-[#8b958d]">{msg}</div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th right>Crates</Th>
            <Th>Reason</Th>
            <Th>By</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.map((m) => (
              <TRow key={m.id}>
                <Td>{fmtD(m.date)}</Td>
                <Td>
                  <Badge
                    label={m.reason === OPENING ? "opening" : m.type}
                    bg={m.type === "in" ? "#e7f4ea" : "#fcf2de"}
                    fg={m.type === "in" ? "#23753a" : "#9a6a12"}
                  />
                </Td>
                <Td right className="font-semibold">
                  {fmtK(m.crates)}
                </Td>
                <Td className="text-[#4c5a51]">{m.reason && m.reason !== OPENING ? m.reason : "—"}</Td>
                <Td className="text-[#4c5a51]">{m.requestedBy || "—"}</Td>
                <Td>
                  {m.status === "approved" ? (
                    <span className="text-[13px] text-[#8b958d]">
                      {m.reviewedBy && m.type === "out" ? `approved by ${m.reviewedBy}` : "recorded"}
                    </span>
                  ) : (
                    <Badge
                      label={m.status}
                      bg={m.status === "pending" ? "#fcf2de" : "#fbeae7"}
                      fg={m.status === "pending" ? "#9a6a12" : "#c7402f"}
                    />
                  )}
                </Td>
                <Td right>
                  <DeleteButton
                    kind="eggMove"
                    id={m.id}
                    what={`this ${m.type === "in" ? "graded-in" : "out"} movement of ${m.crates} crates`}
                  />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Grading in can&apos;t pack more crates than the good eggs collected allow ({S.eggsPerCrate} eggs a
        crate). Crates leaving without a sale need a reason; a large write-off by staff waits for an
        admin before it touches stock. Sales take crates out on their own.
      </Note>
    </>
  );
}
