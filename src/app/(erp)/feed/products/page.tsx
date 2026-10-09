"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { finishedPositions, fmtK, fmtN } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  FormError,
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
  EditButton,
} from "@/components/erp/ui";

export default function FeedProducts() {
  const S = useErp();
  const rows = finishedPositions(S.products, S.runs, S.feedSales);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", bag: "25", price: "" });

  const [error, setError] = useState("");

  const save = async () => {
    const bag = Number(form.bag);
    const price = Number(form.price);
    if (!form.sku.trim()) return setError("Enter a SKU, e.g. LAYER-MASH.");
    if (!form.name.trim()) return setError("Enter the product name.");
    if (!(bag > 0)) return setError("Bag size must be above 0 kg.");
    if (!(price > 0)) return setError("Enter the price per bag.");
    setError("");
    if (!(await S.addProduct({
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      bag,
      price,
    })).ok) return;
    setForm({ sku: "", name: "", bag: "25", price: "" });
    setOpen(false);
  };


  // Admin: name and price. SKU and bag size stay fixed — stock is counted in bags.
  const [edit, setEdit] = useState<{ id: number; name: string; price: string } | null>(null);
  const [editError, setEditError] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const price = Number(edit.price);
    if (!edit.name.trim()) return setEditError("Enter the product name.");
    if (!(price > 0)) return setEditError("Enter the price per bag.");
    setEditError("");
    const r = await S.updateProduct({ id: edit.id, name: edit.name.trim(), price });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Products"
        sub="What the mill makes — each with its own bag weight"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            New product
          </NewButton>
        }
      />

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit product"
        sub="New prices apply to sales and requests from now on"
        onSubmit={() => void saveEdit()}
        submitLabel="Save"
      >
        {edit ? (
          <>
            <TextField label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
            <TextField
              label="Price ₦/bag"
              type="number"
              value={edit.price}
              onChange={(v) => setEdit({ ...edit, price: v })}
            />
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>
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
        <FormError message={error} />
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
                <Td className="font-semibold">
                  {p.name}
                  <EditButton
                    onClick={() => {
                      setEdit({ id: p.id, name: p.name, price: String(p.price) });
                      setEditError("");
                    }}
                  />
                </Td>
                <Td className="text-xs text-[#8b958d]">{p.sku}</Td>
                <Td right>{p.bag} kg</Td>
                <Td right>{fmtN(p.price)}</Td>
                <Td right>{fmtK(p.produced)}</Td>
                <Td right>{fmtK(p.soldBags)}</Td>
                <Td right className="font-bold">
                  {fmtK(Math.max(0, p.bags))} bags
                </Td>
                <Td>
                  <Badge label="active" bg="#e7f4ea" fg="#23753a" />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Bag weight is per product on purpose — a ton is always 1,000 kg, a bag
        is not. Bags in store = bags made in production runs − bags sold.
      </Note>
    </>
  );
}
