"use client";

import { locationPositions } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { FieldRow, SelectField, TextField } from "@/components/erp/Drawer";

const NAME: Record<string, string> = { broilers: "Broilers", brooding: "Brooding", ruminants: "Ruminants", store: "the main store" };

/**
 * Items a health record can draw from: what's on hand at the unit's own
 * location first, then the main store. Each is keyed "location:id".
 */
export function useStoreItems(location: string) {
  const S = useErp();
  return [location, "store"].flatMap((loc) =>
    locationPositions(S.invItems, S.invMoves, loc)
      .filter((i) => i.onHand > 0)
      .map((i) => ({ ...i, loc, key: `${loc}:${i.id}`, where: NAME[loc] ?? loc }))
  );
}

/** Splits a chosen "location:id" into what the action takes. */
export function drawFrom(items: ReturnType<typeof useStoreItems>, key: string) {
  const item = items.find((i) => i.key === key);
  return item ? { item, from: item.loc === "store" ? ("store" as const) : ("unit" as const) } : null;
}

/** "From the store": an item at the unit or in the main store, and how much was used (optional). */
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
  const chosen = items.find((i) => i.key === item);
  return (
    <FieldRow>
      <SelectField
        label="From the store (optional)"
        value={item}
        onChange={(v) => onChange(v, qty)}
        options={[
          { label: "Nothing drawn", value: "" },
          ...items.map((i) => ({ label: `${i.name} — ${i.onHand.toLocaleString("en-US")} ${i.unit} at ${i.where}`, value: i.key })),
        ]}
      />
      {chosen ? <TextField label={`${qtyLabel} (${chosen.unit})`} type="number" value={qty} onChange={(v) => onChange(item, v)} /> : <div />}
    </FieldRow>
  );
}
