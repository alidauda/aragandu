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
  DeleteButton,
  EditButton,
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  FormError,
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
    item: "",
    from: "outside",
    to: "store",
    qty: "",
    by: "",
  });
  // Falls back to the first item so the select and the submitted id agree.
  const moveItem = S.invItems.find((i) => i.id === +move.item) ?? S.invItems[0];
  const [itemError, setItemError] = useState("");
  const [moveError, setMoveError] = useState("");

  const saveItem = async () => {
    const reorder = item.reorder.trim() ? Number(item.reorder) : 0;
    const cost = item.cost.trim() ? Number(item.cost) : 0;
    if (!item.sku.trim()) return setItemError("Enter a SKU.");
    if (!item.name.trim()) return setItemError("Enter the item name.");
    if (!item.unit.trim()) return setItemError("Enter the unit, e.g. vials or kg.");
    if (!Number.isFinite(reorder) || reorder < 0) return setItemError("Reorder level must be 0 or more.");
    if (!Number.isFinite(cost) || cost < 0) return setItemError("Unit cost must be 0 or more.");
    setItemError("");
    if (!(await S.addInvItem({
      sku: item.sku.trim().toUpperCase(),
      name: item.name.trim(),
      cat: item.cat as "medication",
      unit: item.unit.trim(),
      reorder,
      cost,
    })).ok) return;
    setItem({ sku: "", name: "", cat: "medication", unit: "", reorder: "", cost: "" });
    setOpenItem(false);
  };

  const saveMove = async () => {
    const qty = parseFloat(move.qty);
    if (!moveItem) return setMoveError("Add an item first.");
    if (move.from === "outside" && move.to === "used")
      return setMoveError("A receipt goes into a location first, then gets used from there.");
    if (move.from === move.to) return setMoveError("From and to must be different.");
    if (!qty || qty <= 0) return setMoveError("Enter a quantity above 0.");
    if (!move.by.trim()) return setMoveError("Enter who moved it.");
    setMoveError("");
    if (!(await S.addInvMove({
      item: moveItem.id,
      from: move.from === "outside" ? null : move.from,
      to: move.to === "used" ? null : move.to,
      qty,
      by: move.by.trim(),
    })).ok) return;
    setMove({ ...move, qty: "", by: "" });
    setOpenMove(false);
  };


  // Admin: everything but the SKU.
  const [edit, setEdit] = useState<{
    id: number;
    name: string;
    cat: string;
    unit: string;
    reorder: string;
    cost: string;
  } | null>(null);
  const [editError, setEditError] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const reorder = Number(edit.reorder || 0);
    const cost = Number(edit.cost || 0);
    if (!edit.name.trim()) return setEditError("Enter the item name.");
    if (!edit.unit.trim()) return setEditError("Enter the unit.");
    if (!Number.isFinite(reorder) || reorder < 0) return setEditError("Reorder level must be 0 or more.");
    if (!Number.isFinite(cost) || cost < 0) return setEditError("Unit cost must be 0 or more.");
    setEditError("");
    const r = await S.updateInvItem({
      id: edit.id,
      name: edit.name.trim(),
      cat: edit.cat as "medication",
      unit: edit.unit.trim(),
      reorder,
      cost,
    });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Central store"
        title="Inventory"
        sub="Medication, equipment, packaging and supplies — one ledger"
        action={
          <>
            <NewButton
              onClick={() => {
                setMoveError("");
                setOpenMove(true);
              }}
            >
              Record movement
            </NewButton>
            <NewButton
              onClick={() => {
                setItemError("");
                setOpenItem(true);
              }}
            >
              New item
            </NewButton>
          </>
        }
      />


      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit item"
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
                options={["medication", "equipment", "packaging", "supplies"].map((c) => ({ label: c, value: c }))}
              />
              <TextField label="Unit" value={edit.unit} onChange={(v) => setEdit({ ...edit, unit: v })} />
            </FieldRow>
            <FieldRow>
              <TextField
                label="Reorder at"
                type="number"
                value={edit.reorder}
                onChange={(v) => setEdit({ ...edit, reorder: v })}
              />
              <TextField
                label="Unit cost ₦"
                type="number"
                value={edit.cost}
                onChange={(v) => setEdit({ ...edit, cost: v })}
              />
            </FieldRow>
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>
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
        <FormError message={itemError} />
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
          value={String(moveItem?.id ?? "")}
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
        <FormError message={moveError} />
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
                      <EditButton
                        onClick={() => {
                          setEdit({
                            id: r.id,
                            name: r.name,
                            cat: r.cat,
                            unit: r.unit,
                            reorder: String(r.reorder),
                            cost: String(r.cost),
                          });
                          setEditError("");
                        }}
                      />
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
              <Th right />
            </THead>
            <tbody>
              {moves.map((m) => {
                const toBg =
                  m.to === null ? "#fbe9e5" : m.from === null ? "#e8f2e5" : "#eef0e4";
                const toFg =
                  m.to === null ? "#b3402f" : m.from === null ? "#3f6f3a" : "#59614a";
                return (
                  <TRow key={m.id}>
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
                    <Td right>
                      {m.health ? (
                        <span className="text-[11.5px] text-[#8a9070]">health record</span>
                      ) : (
                        <DeleteButton kind="invMove" id={m.id} what="this movement (it's undone)" />
                      )}
                    </Td>
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
