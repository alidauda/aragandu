"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { finishedPositions, fmtD, fmtK, fmtN } from "@/lib/erp/derive";
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
  CardTitle,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function FeedFinished() {
  const S = useErp();
  const finPos = finishedPositions(S.products, S.runs, S.feedSales);
  const sales = [...S.feedSales].sort((a, b) => b.date.localeCompare(a.date));

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product: String(S.products[0]?.id ?? ""),
    channel: "external",
    buyer: "",
    bags: "",
    price: "",
  });

  const save = () => {
    const bags = parseInt(form.bags, 10);
    const price = parseFloat(form.price);
    if (!bags || bags <= 0 || !price || price <= 0 || !form.buyer.trim()) return;
    S.addFeedSale({
      product: +form.product,
      channel: form.channel as "internal" | "external",
      buyer: form.buyer.trim(),
      bags,
      price,
    });
    setForm({ ...form, buyer: "", bags: "", price: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Finished & sales"
        sub="Bags in store, and every sale that drew them down"
        action={<NewButton onClick={() => setOpen(true)}>Record sale</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Record feed sale"
        sub="The price typed here is the one this sale keeps"
        onSubmit={save}
        submitLabel="Record sale"
      >
        <SelectField
          label="Product"
          value={form.product}
          onChange={(v) => setForm({ ...form, product: v })}
          options={S.products.map((p) => ({ label: p.name, value: String(p.id) }))}
        />
        <FieldRow>
          <SelectField
            label="Channel"
            value={form.channel}
            onChange={(v) => setForm({ ...form, channel: v })}
            options={[
              { label: "External buyer", value: "external" },
              { label: "Internal (division)", value: "internal" },
            ]}
          />
          <TextField
            label={form.channel === "internal" ? "Division" : "Buyer"}
            value={form.buyer}
            onChange={(v) => setForm({ ...form, buyer: v })}
            placeholder={form.channel === "internal" ? "Layers" : "Green Acres Farm"}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label="Bags"
            type="number"
            value={form.bags}
            onChange={(v) => setForm({ ...form, bags: v })}
            placeholder="20"
          />
          <TextField
            label="Price ₦/bag"
            type="number"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            placeholder="15500"
          />
        </FieldRow>
      </Drawer>

      <div className="stagger grid grid-cols-3 gap-3.5">
        {finPos.map((f) => (
          <Card key={f.id} className="px-5 py-4">
            <div className="text-[14.5px] font-bold">{f.name}</div>
            <div className="text-xs text-[#8a9070]">
              {f.sku} · {f.bag} kg bags
            </div>
            <div className="mt-2.5 font-display text-2xl font-bold tabular-nums text-[#3c4d28]">
              {fmtK(Math.max(0, f.bags))}{" "}
              <span className="text-[13px] font-semibold text-[#79815f]">bags</span>
            </div>
            <div className="mt-0.5 text-[12.5px] text-[#6c7359]">
              {fmtK(f.produced)} kg produced · {fmtK(f.soldBags)} bags sold
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Feed sales</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Product</Th>
              <Th>Buyer</Th>
              <Th>Channel</Th>
              <Th right>Bags</Th>
              <Th right>₦/bag</Th>
              <Th right>Amount</Th>
            </THead>
            <tbody>
              {sales.map((s) => (
                <TRow key={s.id}>
                  <Td>{fmtD(s.date)}</Td>
                  <Td className="font-semibold">
                    {S.products.find((p) => p.id === s.product)!.name}
                  </Td>
                  <Td>{s.buyer}</Td>
                  <Td>
                    <Badge
                      label={s.channel}
                      bg={s.channel === "internal" ? "#eef0e4" : "#e3f0fa"}
                      fg={s.channel === "internal" ? "#59614a" : "#2f6d9e"}
                    />
                  </Td>
                  <Td right>{s.bags}</Td>
                  <Td right>{fmtK(s.price)}</Td>
                  <Td right className="font-semibold">
                    {fmtN(s.bags * s.price)}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
