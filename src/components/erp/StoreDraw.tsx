"use client";

import { locationPositions } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { FieldRow, SelectField, TextField } from "@/components/erp/Drawer";

/** Items on hand at a unit's store location, for a health record to draw from. */
export function useStoreItems(location: string) {
  const S = useErp();
  return locationPositions(S.invItems, S.invMoves, location).filter((i) => i.onHand > 0);
}

/** "From the store": an item at the location and how much was used (optional). */
export function StoreDraw({
  location,
  item,
  qty,
  onChange,
  qtyLabel = "Quantity used",
}: {
  location: string;
  item: string;
  qty: string;
  onChange: (item: string, qty: string) => void;
  qtyLabel?: string;
}) {
  const items = useStoreItems(location);
  const chosen = items.find((i) => String(i.id) === item);
  return (
    <FieldRow>
      <SelectField
        label="From the store (optional)"
        value={item}
        onChange={(v) => onChange(v, qty)}
        options={[
          { label: "Nothing drawn", value: "" },
          ...items.map((i) => ({ label: `${i.name} (${i.onHand.toLocaleString("en-US")} ${i.unit} here)`, value: String(i.id) })),
        ]}
      />
      {chosen ? (
        <TextField label={`${qtyLabel} (${chosen.unit})`} type="number" value={qty} onChange={(v) => onChange(item, v)} />
      ) : (
        <div />
      )}
    </FieldRow>
  );
}
