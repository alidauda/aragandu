"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, fmtN, runPositions } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import {
  Card,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

type Line = { ing: string; kg: string; price: string };

export default function FeedRuns() {
  const S = useErp();
  const rows = runPositions(S.runs, S.products);

  const [open, setOpen] = useState(false);
  const [run, setRun] = useState("");
  const [product, setProduct] = useState(String(S.products[0]?.id ?? ""));
  const [operator, setOperator] = useState("");
  const [output, setOutput] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ing: "1", kg: "", price: "" }]);

  /** Latest delivery price for an ingredient — the pre-fill, editable. */
  const latestPrice = (ingId: number) =>
    [...S.deliveries]
      .filter((d) => d.ing === ingId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.price ?? 0;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const parsed = lines
      .map((l) => [+l.ing, parseFloat(l.kg), parseFloat(l.price)] as [number, number, number])
      .filter(([, kg, price]) => kg > 0 && price > 0);
    const out = parseFloat(output);
    if (!run.trim() || !operator.trim() || !out || parsed.length === 0) return;
    if (!(await S.addRun({
      run: run.trim().toUpperCase(),
      product: +product,
      operator: operator.trim(),
      output: out,
      lines: parsed,
    })).ok) return;
    setRun("");
    setOperator("");
    setOutput("");
    setLines([{ ing: "1", kg: "", price: "" }]);
    setOpen(false);
  };

  const chargedPreview = lines.reduce((a, l) => a + (parseFloat(l.kg) || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Production runs"
        sub="Charged in, weighed out, costed at the day's prices"
        action={<NewButton onClick={() => setOpen(true)}>New run</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New production run"
        sub="Each line snapshots its price — repricing later never restates this run"
        onSubmit={save}
        submitLabel="Record run"
      >
        <FieldRow>
          <TextField
            label="Run number"
            value={run}
            onChange={setRun}
            placeholder="PR-2608-09"
          />
          <SelectField
            label="Product"
            value={product}
            onChange={setProduct}
            options={S.products.map((p) => ({ label: p.name, value: String(p.id) }))}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label="Operator"
            value={operator}
            onChange={setOperator}
            placeholder="Musa I."
          />
          <TextField
            label="Output kg (weighed off)"
            type="number"
            value={output}
            onChange={setOutput}
            placeholder="1980"
          />
        </FieldRow>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[#79815f]">
            Ingredients charged
          </div>
          <div className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid min-w-0 grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 *:min-w-0">
                <select
                  value={l.ing}
                  onChange={(e) => {
                    const ing = e.target.value;
                    setLine(i, {
                      ing,
                      price: l.price || String(latestPrice(+ing) || ""),
                    });
                  }}
                  className="w-full min-w-0 rounded-lg border border-[#cfd3bd] bg-white px-2 py-2 text-[13px] outline-none"
                >
                  {S.ingredients.map((ing) => (
                    <option key={ing.id} value={String(ing.id)}>
                      {ing.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={l.kg}
                  onChange={(e) => setLine(i, { kg: e.target.value })}
                  placeholder="kg"
                  className="font-data w-full min-w-0 rounded-lg border border-[#cfd3bd] bg-white px-2 py-2 text-[13px] outline-none"
                />
                <input
                  type="number"
                  value={l.price}
                  onChange={(e) => setLine(i, { price: e.target.value })}
                  placeholder="₦/kg"
                  className="font-data w-full min-w-0 rounded-lg border border-[#cfd3bd] bg-white px-2 py-2 text-[13px] outline-none"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setLines((ls) => [...ls, { ing: "1", kg: "", price: "" }])
            }
            className="mt-2 text-[12.5px] font-semibold text-[#3c4d28]"
          >
            + Add ingredient line
          </button>
          <div className="font-data mt-2 text-[11px] text-[#8a9070]">
            {fmtK(chargedPreview)} kg into the mixer · ₦/kg pre-fills from the
            latest delivery
          </div>
        </div>
      </Drawer>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Run</Th>
            <Th>Date</Th>
            <Th>Product</Th>
            <Th>Operator</Th>
            <Th right>Charged kg</Th>
            <Th right>Output kg</Th>
            <Th right>Yield</Th>
            <Th right>Material cost</Th>
            <Th right>₦/kg</Th>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TRow key={r.id}>
                <Td className="font-semibold">{r.run}</Td>
                <Td>{fmtD(r.date)}</Td>
                <Td>{r.pname}</Td>
                <Td className="text-[#59614a]">{r.operator}</Td>
                <Td right>{fmtK(r.charged)}</Td>
                <Td right>{fmtK(r.output)}</Td>
                <Td
                  right
                  className="font-bold"
                >
                  <span
                    style={{ color: r.yieldPct >= 97 ? "#3f6f3a" : "#a06a0e" }}
                  >
                    {r.yieldPct.toFixed(1)}%
                  </span>
                </Td>
                <Td right>{fmtN(r.cost)}</Td>
                <Td right>{fmtN(r.cost / r.output)}</Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Costing uses each line&apos;s price snapshot from the day the ingredient
        was charged.
      </Note>
    </>
  );
}
