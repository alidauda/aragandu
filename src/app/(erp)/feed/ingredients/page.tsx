"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtK, ingredientPositions, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import {
  Badge,
  Card,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function FeedIngredients() {
  const S = useErp();
  const rows = ingredientPositions(S.ingredients, S.deliveries, S.runs);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    cat: "energy",
    reorder: "",
  });

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    if (!(await S.addIngredient({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      cat: form.cat as "energy",
      reorder: parseFloat(form.reorder) || 0,
    })).ok) return;
    setForm({ code: "", name: "", cat: "energy", reorder: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Ingredients"
        sub="Positions derive from deliveries − run lines"
        action={<NewButton onClick={() => setOpen(true)}>New ingredient</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New ingredient"
        sub="A catalog entry — stock arrives later, through deliveries"
        onSubmit={save}
        submitLabel="Add ingredient"
      >
        <FieldRow>
          <TextField
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
            placeholder="ING-GNC"
          />
          <SelectField
            label="Category"
            value={form.cat}
            onChange={(v) => setForm({ ...form, cat: v })}
            options={["energy", "protein", "fibre", "mineral", "additive"].map(
              (c) => ({ label: c, value: c })
            )}
          />
        </FieldRow>
        <TextField
          label="Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Groundnut Cake"
        />
        <TextField
          label="Reorder level (kg)"
          type="number"
          value={form.reorder}
          onChange={(v) => setForm({ ...form, reorder: v })}
          placeholder="500"
        />
      </Drawer>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Ingredient</Th>
            <Th>Category</Th>
            <Th right>Received kg</Th>
            <Th right>Consumed kg</Th>
            <Th right>On hand kg</Th>
            <Th right>Avg ₦/kg</Th>
            <Th>Status</Th>
          </THead>
          <tbody>
            {rows.map((r) => {
              const b = stBadge(r.st);
              return (
                <TRow key={r.id}>
                  <Td>
                    <span className="font-semibold">{r.name}</span>{" "}
                    <span className="text-xs text-[#8a9070]">{r.code}</span>
                  </Td>
                  <Td className="capitalize text-[#59614a]">{r.cat}</Td>
                  <Td right>{fmtK(r.recv)}</Td>
                  <Td right>{fmtK(r.used)}</Td>
                  <Td right className="font-bold">
                    {fmtK(r.onHand)}
                  </Td>
                  <Td right>{fmtK(Math.round(r.avg))}</Td>
                  <Td>
                    <Badge label={r.st} bg={b.bg} fg={b.fg} />
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>Positions derive from deliveries − run lines; nothing is stored.</Note>
    </>
  );
}
