"use client";

import { useState } from "react";

import { fmtK, fmtN } from "@/lib/erp/derive";
import { batchEstimates, broilerBatchEstimates } from "@/lib/erp/finance";
import { useErp } from "@/lib/erp/store";
import { FinanceTabs } from "@/components/erp/FinanceTabs";
import { Badge, Card, CardTitle, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { Drawer, FieldRow, FormError, TextField } from "@/components/erp/Drawer";

/** Each batch from purchase to selling its birds. */
export default function FinanceBatches() {
  const S = useErp();
  const rows = batchEstimates(S, S.today);
  const paged = usePaged(rows);
  const birdRows = broilerBatchEstimates(S);
  const birdPage = usePaged(birdRows);
  const canEdit = S.canDo("finance", "admin");

  const [edit, setEdit] = useState<{ batch: string; purchaseCost: string; birdPrice: string; birds?: boolean } | null>(null);
  const [error, setError] = useState("");
  const save = async () => {
    const purchaseCost = Number(edit!.purchaseCost);
    const birdPrice = Number(edit!.birdPrice);
    if (!Number.isInteger(purchaseCost) || purchaseCost < 0) return setError("Enter the cost in whole naira.");
    if (!Number.isInteger(birdPrice) || birdPrice < 0) return setError("Enter the price in whole naira.");
    const costs = { batch: edit!.batch, purchaseCost, birdPrice };
    const r = edit!.birds ? await S.setBroilerBatchCosts(costs) : await S.setBatchCosts(costs);
    if (!r.ok) return setError(r.error);
    setEdit(null);
  };

  return (
    <>
      <PageHeader eyebrow="Finance" title="Batch estimate" sub="Cost of purchasing, every month's analysis, and selling the birds" />
      <FinanceTabs />

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={`Costs of ${edit?.batch ?? "batch"}`}
        sub="Seen only in Finance"
        onSubmit={() => void save()}
        submitLabel="Save"
      >
        {edit ? (
          <FieldRow>
            <TextField
              label="Cost of purchasing ₦"
              type="number"
              value={edit.purchaseCost}
              onChange={(v) => setEdit({ ...edit, purchaseCost: v })}
              placeholder="The whole batch"
            />
            <TextField
              label="Expected price per bird ₦"
              type="number"
              value={edit.birdPrice}
              onChange={(v) => setEdit({ ...edit, birdPrice: v })}
              placeholder="4200"
            />
          </FieldRow>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={paged.pager}>
          <THead>
            <Th>Batch</Th>
            <Th right>Purchase</Th>
            <Th right>Feed</Th>
            <Th right>Its expenses</Th>
            <Th right>Eggs</Th>
            <Th right>Manure</Th>
            <Th right>Birds sold</Th>
            <Th right>Birds left</Th>
            <Th right>Net</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={10} className="text-[#84908f]">
                  No batches yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((b) => (
              <TRow key={b.batch}>
                <Td>
                  <span className="font-semibold">{b.batch}</span>
                  {b.status === "closed" ? (
                    <span className="ml-2">
                      <Badge label="closed" bg="#ebf0ef" fg="#5d6b6b" />
                    </span>
                  ) : null}
                  <div className="text-[12px] text-[#84908f]">{b.breed}</div>
                </Td>
                <Td right>{b.purchaseCost ? fmtN(b.purchaseCost) : "—"}</Td>
                <Td right>{fmtN(b.feedCost)}</Td>
                <Td right>{fmtN(b.expenses)}</Td>
                <Td right>{fmtN(b.eggSales)}</Td>
                <Td right>{fmtN(b.manureSales)}</Td>
                <Td right>{fmtN(b.birdSales)}</Td>
                <Td right>
                  {fmtN(b.expectedSale)}
                  <div className="text-[11.5px] text-[#84908f]">
                    {fmtK(b.birdsLeft)} × {fmtN(b.birdPrice)}
                  </div>
                </Td>
                <Td right className="font-semibold">
                  <span style={{ color: b.net < 0 ? "#c7402f" : "#016559" }}>
                    {b.net < 0 ? `(${fmtN(-b.net)})` : fmtN(b.net)}
                  </span>
                  {b.complete ? null : <div className="text-[11.5px] font-normal text-[#9a6a12]">costs missing</div>}
                </Td>
                <Td right>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setEdit({
                          batch: b.batch,
                          purchaseCost: b.purchaseCost ? String(b.purchaseCost) : "",
                          birdPrice: b.birdPrice ? String(b.birdPrice) : "",
                        });
                      }}
                      className="text-[13px] font-semibold text-[#055a5b]"
                    >
                      Edit
                    </button>
                  ) : null}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card className="mt-4 overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <div className="px-4 pt-3.5">
          <CardTitle>Broilers and Brooding batches</CardTitle>
        </div>
        <div className="mt-2">
          <Table pager={birdPage.pager}>
            <THead>
              <Th>Batch</Th>
              <Th right>Purchase</Th>
              <Th right>Feed</Th>
              <Th right>Its expenses</Th>
              <Th right>Sold live</Th>
              <Th right>Processed</Th>
              <Th right>Birds left</Th>
              <Th right>Net</Th>
              <Th right />
            </THead>
            <tbody>
              {birdRows.length === 0 ? (
                <TRow>
                  <Td colSpan={9} className="text-[#84908f]">
                    No broiler or brooding batches yet.
                  </Td>
                </TRow>
              ) : null}
              {birdPage.rows.map((b) => (
                <TRow key={b.batch}>
                  <Td>
                    <span className="font-semibold">{b.batch}</span>
                    {b.status === "closed" ? (
                      <span className="ml-2">
                        <Badge label="closed" bg="#ebf0ef" fg="#5d6b6b" />
                      </span>
                    ) : null}
                    <div className="text-[12px] text-[#84908f]">
                      {b.unit === "brooding" ? "Brooding" : "Broilers"} · {b.breed}
                      {b.sentOn ? ` · ${fmtK(b.sentOn)} sent on` : ""}
                    </div>
                  </Td>
                  <Td right>{b.purchaseCost ? fmtN(b.purchaseCost) : "—"}</Td>
                  <Td right>{fmtN(b.feedCost)}</Td>
                  <Td right>{fmtN(b.expenses)}</Td>
                  <Td right>{fmtN(b.liveSales)}</Td>
                  <Td right>{b.processedShare ? fmtN(b.processedShare) : "—"}</Td>
                  <Td right>
                    {fmtN(b.expectedSale)}
                    <div className="text-[11.5px] text-[#84908f]">
                      {fmtK(b.birdsLeft)} × {fmtN(b.birdPrice)}
                    </div>
                  </Td>
                  <Td right className="font-semibold">
                    <span style={{ color: b.net < 0 ? "#c7402f" : "#016559" }}>{b.net < 0 ? `(${fmtN(-b.net)})` : fmtN(b.net)}</span>
                    {b.complete ? null : <div className="text-[11.5px] font-normal text-[#9a6a12]">costs missing</div>}
                  </Td>
                  <Td right>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setEdit({
                            batch: b.batch,
                            purchaseCost: b.purchaseCost ? String(b.purchaseCost) : "",
                            birdPrice: b.birdPrice ? String(b.birdPrice) : "",
                            birds: true,
                          });
                        }}
                        className="text-[13px] font-semibold text-[#055a5b]"
                      >
                        Edit
                      </button>
                    ) : null}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Net = eggs + manure + birds sold + birds left at the expected price − purchase − feed − expenses set against the
        batch. It adds up each month&apos;s analysis since the batch arrived. Salaries and other shared costs aren&apos;t split
        between batches, so they aren&apos;t in here. Birds sold come from sales invoices linked to the batch. Broilers and
        Brooding batches: feed is costed at the average price of their unit&apos;s feed, processed chicken sold is shared
        out by the carcass each batch gave, and birds Brooding sent on aren&apos;t counted as sales.
      </Note>
    </>
  );
}
