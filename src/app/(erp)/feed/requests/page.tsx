"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, stBadge } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  FormError,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";
import { DIVISIONS, divisionBuyer, type Division } from "@/lib/erp/divisions";
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
  const [error, setError] = useState("");
  const [form, setForm] = useState<{
    division: Division;
    product: string;
    bags: string;
    by: string;
  }>({ division: "layers", product: "", bags: "", by: "" });
  // Falls back to the first product so the select and the submitted id agree.
  const product = S.products.find((p) => p.id === +form.product) ?? S.products[0];

  const save = async () => {
    const bags = Number(form.bags);
    if (!product) return setError("Add a feed product first.");
    if (!Number.isInteger(bags) || bags <= 0) return setError("Enter a whole number of bags.");
    if (!form.by.trim()) return setError("Enter who is requesting.");
    setError("");
    if (!(await S.addFeedRequest({
      division: form.division,
      product: product.id,
      bags,
      by: form.by.trim(),
    })).ok) return;
    setForm({ ...form, bags: "", by: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Requests"
        sub="Divisions asking the mill for feed"
        action={
          <NewButton
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            New request
          </NewButton>
        }
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New feed request"
        sub="Fulfilling issues the bags from finished stock at the product's list price"
        onSubmit={save}
        submitLabel="Raise request"
      >
        <FieldRow>
          <SelectField
            label="Division"
            value={form.division}
            onChange={(v) => setForm({ ...form, division: v as Division })}
            options={DIVISIONS.map((d) => ({ label: divisionBuyer(d), value: d }))}
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
          value={String(product?.id ?? "")}
          onChange={(v) => setForm({ ...form, product: v })}
          options={S.products.map((p) => ({ label: p.name, value: String(p.id) }))}
        />
        <TextField
          label="Requested by"
          value={form.by}
          onChange={(v) => setForm({ ...form, by: v })}
          placeholder="B. Okon"
        />
        <FormError message={error} />
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
                      <span className="whitespace-nowrap">
                        <PrimaryButton onClick={() => S.fulfilRequest(q)}>
                          Fulfil → issue bags
                        </PrimaryButton>
                        <button
                          onClick={() => S.declineRequest(q)}
                          disabled={S.saving}
                          className="ml-1.5 rounded-lg border border-[#e2c9c3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#8a5a52]"
                        >
                          Decline
                        </button>
                      </span>
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
