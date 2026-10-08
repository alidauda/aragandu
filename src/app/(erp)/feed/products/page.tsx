"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { finishedPositions, fmtK, fmtN } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
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

export default function FeedProducts() {
  const S = useErp();
  const rows = finishedPositions(S.products, S.runs, S.feedSales);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", bag: "25", price: "" });

  const save = () => {
    if (!form.sku.trim() || !form.name.trim()) return;
    S.addProduct({
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      bag: parseFloat(form.bag) || 25,
      price: parseFloat(form.price) || 0,
    });
    setForm({ sku: "", name: "", bag: "25", price: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Products"
        sub="What the mill makes — each with its own bag weight"
        action={<NewButton onClick={() => setOpen(true)}>New product</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New product"
        sub="Stock arrives through production runs, never typed in"
        onSubmit={save}
        submitLabel="Add product"
      >
        <FieldRow>
          <TextField
            label="SKU"
            value={form.sku}
            onChange={(v) => setForm({ ...form, sku: v })}
            placeholder="LAYER-CONC"
          />
          <TextField
            label="Bag weight (kg)"
            type="number"
            value={form.bag}
            onChange={(v) => setForm({ ...form, bag: v })}
          />
        </FieldRow>
        <TextField
          label="Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Layer Concentrate"
        />
        <TextField
          label="Price ₦/bag"
          type="number"
          value={form.price}
          onChange={(v) => setForm({ ...form, price: v })}
          placeholder="18500"
        />
      </Drawer>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th right>Bag weight</Th>
            <Th right>Price / bag</Th>
            <Th right>Produced kg</Th>
            <Th right>Sold bags</Th>
            <Th right>In store</Th>
            <Th>Status</Th>
          </THead>
          <tbody>
            {rows.map((p) => (
              <TRow key={p.id}>
                <Td className="font-semibold">{p.name}</Td>
                <Td className="text-xs text-[#8a9070]">{p.sku}</Td>
                <Td right>{p.bag} kg</Td>
                <Td right>{fmtN(p.price)}</Td>
                <Td right>{fmtK(p.produced)}</Td>
                <Td right>{fmtK(p.soldBags)}</Td>
                <Td right className="font-bold">
                  {fmtK(Math.max(0, p.bags))} bags
                </Td>
                <Td>
                  <Badge label="active" bg="#e8f2e5" fg="#3f6f3a" />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Bag weight is per product on purpose — a ton is always 1,000 kg, a bag
        is not. The in-store figure derives from runs − sales.
      </Note>
    </>
  );
}
