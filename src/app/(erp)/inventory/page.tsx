"use client";

import { useState } from "react";

import { monthName } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import { fmtD, fmtK, fmtN, inventoryPositions, stBadge } from "@/lib/erp/derive";
import {
  Badge,
  Card,
  CardTitle,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";

const LOCATIONS = ["store", "layers", "broilers", "ruminants", "crops", "orchard", "feed"];

export default function Inventory() {
  const S = useErp();
  const pos = inventoryPositions(S.invItems, S.invMoves);
  const value = pos.reduce((a, i) => a + i.value, 0);
  const attention = pos.filter((i) => i.st !== "in-stock").length;
  const movesMonth = S.invMoves.filter((m) => m.date >= S.today.slice(0, 8) + "01").length;
  const moves = [...S.invMoves].sort((a, b) => b.date.localeCompare(a.date));

  const [openItem, setOpenItem] = useState(false);
  const [item, setItem] = useState({
    sku: "",
    name: "",
    cat: "medication",
    unit: "",
    reorder: "",
    cost: "",
  });

  const [openMove, setOpenMove] = useState(false);
  const [move, setMove] = useState({
    item: String(S.invItems[0]?.id ?? ""),
    from: "outside",
    to: "store",
    qty: "",
    by: "",
  });

  const saveItem = () => {
    if (!item.sku.trim() || !item.name.trim() || !item.unit.trim()) return;
    S.addInvItem({
      sku: item.sku.trim().toUpperCase(),
      name: item.name.trim(),
      cat: item.cat as "medication",
      unit: item.unit.trim(),
      reorder: parseFloat(item.reorder) || 0,
      cost: parseFloat(item.cost) || 0,
    });
    setItem({ sku: "", name: "", cat: "medication", unit: "", reorder: "", cost: "" });
    setOpenItem(false);
  };

  const saveMove = () => {
    const qty = parseFloat(move.qty);
    if (!qty || qty <= 0 || !move.by.trim()) return;
    if (move.from === move.to) return;
    S.addInvMove({
      item: +move.item,
      from: move.from === "outside" ? null : move.from,
      to: move.to === "used" ? null : move.to,
      qty,
      by: move.by.trim(),
    });
    setMove({ ...move, qty: "", by: "" });
    setOpenMove(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Central store"
        title="Inventory"
        sub="Medication, equipment, packaging and supplies — one ledger"
        action={
          <>
            <NewButton onClick={() => setOpenMove(true)}>Record movement</NewButton>
            <NewButton onClick={() => setOpenItem(true)}>New item</NewButton>
          </>
        }
      />

      <Drawer
        open={openItem}
        onClose={() => setOpenItem(false)}
        title="New item"
        sub="A catalog entry — stock arrives through movements"
        onSubmit={saveItem}
        submitLabel="Add item"
      >
        <FieldRow>
          <TextField
            label="SKU"
            value={item.sku}
            onChange={(v) => setItem({ ...item, sku: v })}
            placeholder="MED-GUMBORO"
          />
          <SelectField
            label="Category"
            value={item.cat}
            onChange={(v) => setItem({ ...item, cat: v })}
            options={["medication", "equipment", "packaging", "supplies"].map(
              (c) => ({ label: c, value: c })
            )}
          />
        </FieldRow>
        <TextField
          label="Name"
          value={item.name}
          onChange={(v) => setItem({ ...item, name: v })}
          placeholder="Gumboro Vaccine"
        />
        <FieldRow>
          <TextField
            label="Unit"
            value={item.unit}
            onChange={(v) => setItem({ ...item, unit: v })}
            placeholder="vials"
          />
          <TextField
            label="Reorder at"
            type="number"
            value={item.reorder}
            onChange={(v) => setItem({ ...item, reorder: v })}
            placeholder="20"
          />
        </FieldRow>
        <TextField
          label="Unit cost ₦"
          type="number"
          value={item.cost}
          onChange={(v) => setItem({ ...item, cost: v })}
          placeholder="1800"
        />
      </Drawer>

      <Drawer
        open={openMove}
        onClose={() => setOpenMove(false)}
        title="Record movement"
        sub="Receipt, transfer or write-off — the only way stock changes"
        onSubmit={saveMove}
        submitLabel="Record movement"
      >
        <SelectField
          label="Item"
          value={move.item}
          onChange={(v) => setMove({ ...move, item: v })}
          options={S.invItems.map((i) => ({
            label: `${i.name} (${i.sku})`,
            value: String(i.id),
          }))}
        />
        <FieldRow>
          <SelectField
            label="From"
            value={move.from}
            onChange={(v) => setMove({ ...move, from: v })}
            options={[
              { label: "Outside (receipt)", value: "outside" },
              ...LOCATIONS.map((l) => ({ label: l, value: l })),
            ]}
          />
          <SelectField
            label="To"
            value={move.to}
            onChange={(v) => setMove({ ...move, to: v })}
            options={[
              ...LOCATIONS.map((l) => ({ label: l, value: l })),
              { label: "Used (write-off)", value: "used" },
            ]}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label="Quantity"
            type="number"
            value={move.qty}
            onChange={(v) => setMove({ ...move, qty: v })}
            placeholder="24"
          />
          <TextField
            label="Moved by"
            value={move.by}
            onChange={(v) => setMove({ ...move, by: v })}
            placeholder="K. Adamu"
          />
        </FieldRow>
      </Drawer>

      <div className="stagger grid grid-cols-4 gap-3.5">
        <Kpi label="Items tracked" value={String(pos.length)} sub="4 categories" />
        <Kpi
          label="Stock value"
          value={fmtN(value)}
          formula="Σ on hand × unit cost"
        />
        <Kpi
          label="Needs attention"
          value={String(attention)}
          sub="low or out of stock"
          color={attention ? "#b3402f" : "#3f6f3a"}
        />
        <Kpi
          label={`Movements — ${monthName(S.today)}`}
          value={String(movesMonth)}
          sub="receipts, transfers, use"
          color="#2f7cb6"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Stock register</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Item</Th>
              <Th>Category</Th>
              <Th>Unit</Th>
              <Th right>On hand</Th>
              <Th right>Reorder at</Th>
              <Th right>Stock value</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {pos.map((r) => {
                const b = stBadge(r.st);
                return (
                  <TRow key={r.id}>
                    <Td>
                      <span className="font-semibold">{r.name}</span>{" "}
                      <span className="text-xs text-[#8a9070]">{r.sku}</span>
                    </Td>
                    <Td className="capitalize text-[#59614a]">{r.cat}</Td>
                    <Td className="text-[#59614a]">{r.unit}</Td>
                    <Td right className="font-bold">
                      {fmtK(r.onHand)}
                    </Td>
                    <Td right className="text-[#8a9070]">
                      {fmtK(r.reorder)}
                    </Td>
                    <Td right>{fmtN(r.value)}</Td>
                    <Td>
                      <Badge label={r.st} bg={b.bg} fg={b.fg} />
                    </Td>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Movement ledger</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Item</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th right>Qty</Th>
              <Th>Moved by</Th>
            </THead>
            <tbody>
              {moves.map((m, i) => {
                const toBg =
                  m.to === null ? "#fbe9e5" : m.from === null ? "#e8f2e5" : "#eef0e4";
                const toFg =
                  m.to === null ? "#b3402f" : m.from === null ? "#3f6f3a" : "#59614a";
                return (
                  <TRow key={i}>
                    <Td>{fmtD(m.date)}</Td>
                    <Td className="font-semibold">
                      {S.invItems.find((it) => it.id === m.item)?.name ?? "—"}
                    </Td>
                    <Td className="capitalize text-[#59614a]">{m.from || "—"}</Td>
                    <Td>
                      <Badge label={m.to || "used"} bg={toBg} fg={toFg} />
                    </Td>
                    <Td right>{fmtK(m.qty)}</Td>
                    <Td className="text-[#59614a]">{m.by}</Td>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Movements are the only way stock changes. Blank &quot;from&quot; =
        receipt from outside; &quot;used&quot; = consumed or written off.
      </Note>
    </>
  );
}
