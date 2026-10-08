"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
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
  DeleteButton,
} from "@/components/erp/ui";

export default function FeedDeliveries() {
  const S = useErp();
  const rows = [...S.deliveries].sort((a, b) => b.date.localeCompare(a.date));
  const totalKg = S.deliveries.reduce((a, d) => a + d.kg, 0);
  const totalSpend = S.deliveries.reduce((a, d) => a + d.kg * d.price, 0);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ing: "", kg: "", price: "" });
  const ing = S.ingredients.find((i) => i.id === +form.ing) ?? S.ingredients[0];

  const save = async () => {
    const kg = parseFloat(form.kg);
    const price = parseFloat(form.price);
    if (!ing) return setError("Add an ingredient first.");
    if (!kg || kg <= 0) return setError("Enter the kg delivered.");
    if (!price || price <= 0) return setError("Enter the price per kg.");
    setError("");
    if (!(await S.addDelivery({ ing: ing.id, kg, price })).ok) return;
    setForm({ ...form, kg: "", price: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Deliveries"
        sub="Every receipt keeps the price paid on the day"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            Record delivery
          </NewButton>
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record delivery"
        sub="The only way ingredient stock goes up"
        onSubmit={save}
        submitLabel="Record delivery"
      >
        <SelectField
          label="Ingredient"
          value={String(ing?.id ?? "")}
          onChange={(v) => setForm({ ...form, ing: v })}
          options={S.ingredients.map((i) => ({
            label: `${i.name} (${i.code})`,
            value: String(i.id),
          }))}
        />
        <FieldRow>
          <TextField
            label="Quantity (kg)"
            type="number"
            value={form.kg}
            onChange={(v) => setForm({ ...form, kg: v })}
            placeholder="3000"
          />
          <TextField
            label="Price ₦/kg today"
            type="number"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            placeholder="425"
          />
        </FieldRow>
        <FormError message={error} />
      </Drawer>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Kpi label="Deliveries" value={String(S.deliveries.length)} sub="ingredient receipts" />
        <Kpi label="Received" value={`${fmtK(totalKg)} kg`} sub="all-time" color="#3a8bd6" />
        <Kpi label="Spend" value={fmtN(totalSpend)} sub="at each day's price" color="#9a6a12" />
      </div>

      <Card className="mt-4 overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Ingredient</Th>
            <Th right>Kg</Th>
            <Th right>₦/kg</Th>
            <Th right>Amount</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.map((d, i) => (
              <TRow key={d.id}>
                <Td>{fmtD(d.date)}</Td>
                <Td className="font-semibold">
                  {S.ingredients.find((ing) => ing.id === d.ing)!.name}
                </Td>
                <Td right>{fmtK(d.kg)}</Td>
                <Td right>{fmtK(d.price)}</Td>
                <Td right className="font-semibold">
                  {fmtN(d.kg * d.price)}
                </Td>
                <Td right>
                  <DeleteButton kind="delivery" id={d.id} what={`the ${fmtD(d.date)} delivery of ${fmtK(d.kg)} kg`} />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        The only way ingredient stock goes up — and, because every delivery
        keeps its price, the price history for free.
      </Note>
    </>
  );
}
