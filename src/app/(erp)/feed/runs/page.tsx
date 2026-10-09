"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, fmtN, runPositions } from "@/lib/erp/derive";
import {
  DayField,
  Drawer,
  FieldRow,
  FormError,
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
  DeleteButton,
} from "@/components/erp/ui";

type Line = { ing: string; kg: string; price: string };

export default function FeedRuns() {
  const S = useErp();
  const rows = runPositions(S.runs, S.products);

  const [open, setOpen] = useState(false);
  const [run, setRun] = useState("");
  const [product, setProduct] = useState("");
  const [operator, setOperator] = useState("");
  const [output, setOutput] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  const selectedProduct = S.products.find((p) => p.id === +product) ?? S.products[0];

  /** Latest delivery price for an ingredient — the pre-fill, editable. */
  const latestPrice = (ingId: number) =>
    [...S.deliveries]
      .filter((d) => d.ing === ingId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.price ?? 0;

  /** A fresh line on the first ingredient, its price pre-filled. */
  const newLine = (): Line => {
    const first = S.ingredients[0];
    return {
      ing: first ? String(first.id) : "",
      kg: "",
      price: first ? String(latestPrice(first.id) || "") : "",
    };
  };
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));

  const save = async () => {
    // Blank lines are skipped; a line with kg must have a price — never drop it.
    const filled = lines.filter((l) => l.kg.trim() !== "");
    const out = parseFloat(output);
    if (!selectedProduct) return setError("Add a feed product first.");
    if (!run.trim()) return setError("Enter the run number.");
    if (!operator.trim()) return setError("Enter the operator.");
    if (!out || out <= 0) return setError("Enter the output in kg.");
    if (filled.length === 0) return setError("Add at least one ingredient line.");
    for (const l of filled) {
      const name = S.ingredients.find((i) => i.id === +l.ing)?.name ?? "an ingredient";
      if (!(parseFloat(l.kg) > 0)) return setError(`Enter the kg of ${name}.`);
      if (!(parseFloat(l.price) >= 0) || l.price.trim() === "")
        return setError(`Enter the ₦/kg for ${name}.`);
    }
    const charged = filled.reduce((a, l) => a + parseFloat(l.kg), 0);
    if (
      out > charged &&
      !window.confirm(
        `Output (${fmtK(out)} kg) is more than went into the mixer (${fmtK(charged)} kg). Record it anyway?`
      )
    ) {
      return;
    }
    setError("");
    const parsed = filled.map(
      (l) => [+l.ing, parseFloat(l.kg), parseFloat(l.price)] as [number, number, number]
    );
    if (!(await S.addRun({
      run: run.trim().toUpperCase(),
      product: selectedProduct.id,
      operator: operator.trim(),
      output: out,
      lines: parsed,
      date: day || undefined,
    })).ok) return;
    setRun("");
    setOperator("");
    setOutput("");
    setDay("");
    setLines([newLine()]);
    setOpen(false);
  };

  const chargedPreview = lines.reduce((a, l) => a + (parseFloat(l.kg) || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Production runs"
        sub="Charged in, weighed out, costed at the day's prices"
        action={
          <NewButton
            onClick={() => {
              setError("");
              // Untouched lines are rebuilt so their prices are current.
              if (lines.every((l) => !l.kg.trim())) setLines([newLine()]);
              setOpen(true);
            }}
          >
            New run
          </NewButton>
        }
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
            value={String(selectedProduct?.id ?? "")}
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
          <div className="mb-1.5 text-[13px] font-semibold text-[#4c5a51]">
            Ingredients charged
          </div>
          <div className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <div key={i} className="grid min-w-0 grid-cols-[1.4fr_0.8fr_0.8fr] gap-2 *:min-w-0">
                <select
                  value={l.ing}
                  onChange={(e) => {
                    const ing = e.target.value;
                    // Switching ingredient brings that ingredient's price.
                    setLine(i, { ing, price: String(latestPrice(+ing) || "") });
                  }}
                  className="w-full min-w-0 rounded-lg border border-[#dce1da] bg-white px-2 py-2 text-[13px] outline-none"
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
                  className="font-data w-full min-w-0 rounded-lg border border-[#dce1da] bg-white px-2 py-2 text-[13px] outline-none"
                />
                <input
                  type="number"
                  value={l.price}
                  onChange={(e) => setLine(i, { price: e.target.value })}
                  placeholder="₦/kg"
                  className="font-data w-full min-w-0 rounded-lg border border-[#dce1da] bg-white px-2 py-2 text-[13px] outline-none"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setLines((ls) => [...ls, newLine()])
            }
            className="mt-2 text-[12.5px] font-semibold text-[#2f8f46]"
          >
            + Add ingredient line
          </button>
          <div className="font-data mt-2 text-[11px] text-[#8b958d]">
            {fmtK(chargedPreview)} kg into the mixer · ₦/kg pre-fills from the
            latest delivery
          </div>
          <div className="mt-3">
            <DayField label="Run date" value={day} onChange={setDay} />
          </div>
          <div className="mt-2">
            <FormError message={error} />
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
            <Th right />
          </THead>
          <tbody>
            {rows.map((r) => (
              <TRow key={r.id}>
                <Td className="font-semibold">{r.run}</Td>
                <Td>{fmtD(r.date)}</Td>
                <Td>{r.pname}</Td>
                <Td className="text-[#4c5a51]">{r.operator}</Td>
                <Td right>{fmtK(r.charged)}</Td>
                <Td right>{fmtK(r.output)}</Td>
                <Td
                  right
                  className="font-bold"
                >
                  <span
                    style={{ color: r.yieldPct >= 97 ? "#23753a" : "#9a6a12" }}
                  >
                    {r.yieldPct.toFixed(1)}%
                  </span>
                </Td>
                <Td right>{fmtN(r.cost)}</Td>
                <Td right>{fmtN(r.cost / r.output)}</Td>
                <Td right>
                  <DeleteButton kind="run" id={r.id} what={`run ${r.run}`} />
                </Td>
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
