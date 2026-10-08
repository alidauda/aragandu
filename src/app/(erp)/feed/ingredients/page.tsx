"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtK, ingredientPositions, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  FormError,
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
  EditButton,
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

  const [error, setError] = useState("");

  const save = async () => {
    const reorder = form.reorder.trim() === "" ? 0 : Number(form.reorder);
    if (!form.code.trim()) return setError("Enter a code, e.g. ING-MAIZE.");
    if (!form.name.trim()) return setError("Enter the ingredient name.");
    if (!Number.isFinite(reorder) || reorder < 0) return setError("Reorder level must be 0 or more.");
    setError("");
    if (!(await S.addIngredient({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      cat: form.cat as "energy",
      reorder,
    })).ok) return;
    setForm({ code: "", name: "", cat: "energy", reorder: "" });
    setOpen(false);
  };


  // Admin: name, category and reorder level (the code stays fixed).
  const [edit, setEdit] = useState<{ id: number; name: string; cat: string; reorder: string } | null>(null);
  const [editError, setEditError] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const reorder = Number(edit.reorder || 0);
    if (!edit.name.trim()) return setEditError("Enter the ingredient name.");
    if (!Number.isFinite(reorder) || reorder < 0) return setEditError("Reorder level must be 0 or more.");
    setEditError("");
    const r = await S.updateIngredient({
      id: edit.id,
      name: edit.name.trim(),
      cat: edit.cat as "energy",
      reorder,
    });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Ingredients"
        sub="Positions derive from deliveries − run lines"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            New ingredient
          </NewButton>
        }
      />

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit ingredient"
        onSubmit={() => void saveEdit()}
        submitLabel="Save"
      >
        {edit ? (
          <>
            <TextField label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
            <FieldRow>
              <SelectField
                label="Category"
                value={edit.cat}
                onChange={(v) => setEdit({ ...edit, cat: v })}
                options={["energy", "protein", "fibre", "mineral", "additive"].map((c) => ({ label: c, value: c }))}
              />
              <TextField
                label="Reorder at (kg)"
                type="number"
                value={edit.reorder}
                onChange={(v) => setEdit({ ...edit, reorder: v })}
              />
            </FieldRow>
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>
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
        <FormError message={error} />
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
                    <span className="text-xs text-[#8b958d]">{r.code}</span>
                    <EditButton
                      onClick={() => {
                        setEdit({ id: r.id, name: r.name, cat: r.cat, reorder: String(r.reorder) });
                        setEditError("");
                      }}
                    />
                  </Td>
                  <Td className="capitalize text-[#4c5a51]">{r.cat}</Td>
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
