"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, stBadge } from "@/lib/erp/derive";
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
  PrimaryButton,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function FeedRequests() {
  const S = useErp();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    division: "layers",
    product: String(S.products[0]?.id ?? ""),
    bags: "",
    by: "",
  });

  const save = () => {
    const bags = parseInt(form.bags, 10);
    if (!bags || bags <= 0 || !form.by.trim()) return;
    S.addFeedRequest({
      division: form.division,
      product: +form.product,
      bags,
      by: form.by.trim(),
    });
    setForm({ ...form, bags: "", by: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Requests"
        sub="Divisions asking the mill for feed"
        action={<NewButton onClick={() => setOpen(true)}>New request</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New feed request"
        sub="Requests carry no money — the price is agreed at fulfilment"
        onSubmit={save}
        submitLabel="Raise request"
      >
        <FieldRow>
          <SelectField
            label="Division"
            value={form.division}
            onChange={(v) => setForm({ ...form, division: v })}
            options={["layers", "broilers", "ruminants"].map((d) => ({
              label: d,
              value: d,
            }))}
          />
          <TextField
            label="Bags"
            type="number"
            value={form.bags}
            onChange={(v) => setForm({ ...form, bags: v })}
            placeholder="40"
          />
        </FieldRow>
        <SelectField
          label="Product"
          value={form.product}
          onChange={(v) => setForm({ ...form, product: v })}
          options={S.products.map((p) => ({ label: p.name, value: String(p.id) }))}
        />
        <TextField
          label="Requested by"
          value={form.by}
          onChange={(v) => setForm({ ...form, by: v })}
          placeholder="B. Okon"
        />
      </Drawer>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Division</Th>
            <Th>Product</Th>
            <Th right>Bags</Th>
            <Th>Requested by</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {S.reqs.map((q) => {
              const b = stBadge(q.status);
              return (
                <TRow key={q.id}>
                  <Td>{fmtD(q.date)}</Td>
                  <Td className="capitalize">{q.division}</Td>
                  <Td className="font-semibold">
                    {S.products.find((p) => p.id === q.product)!.name}
                  </Td>
                  <Td right>{q.bags}</Td>
                  <Td className="text-[#59614a]">{q.by}</Td>
                  <Td>
                    <Badge label={q.status} bg={b.bg} fg={b.fg} />
                  </Td>
                  <Td right>
                    {q.status === "pending" ? (
                      <PrimaryButton onClick={() => S.fulfilRequest(q)}>
                        Fulfil → invoice
                      </PrimaryButton>
                    ) : null}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Fulfilling a request creates the internal sale at today&apos;s bag price
        and flips the status — one transaction.
      </Note>
    </>
  );
}
