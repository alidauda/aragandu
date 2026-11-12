"use client";

import { useState } from "react";

import type { editEntry } from "@/lib/erp/actions";
import { fmtD } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import type {
  AnimalWeight,
  BirdOut,
  BroilerDaily,
  BroilerFeedDelivery,
  BroilerWeighing,
  EggMove,
  FeedUse,
  LayersFeedDelivery,
  ManureEntry,
  ProdEntry,
  Product,
  RuminantFeed,
  WaterLog,
} from "@/lib/erp/types";
import { Drawer, FormError, SelectField, TextField } from "@/components/erp/Drawer";

/** One box on an edit form; values travel as the text typed. */
export type EditField = {
  key: string;
  label: string;
  value: string;
  type?: "number" | "text" | "date";
  /** Choices, for a select. */
  options?: { label: string; value: string }[];
};

type EditInput = Parameters<typeof editEntry>[0];

/**
 * "Edit" on a recorded entry, for admins of that part of the farm: opens
 * the entry's figures to correct in place. `save` turns what was typed into
 * the change to make, or a message saying what's wrong with it.
 */
export function EditButton({
  what,
  fields,
  save,
}: {
  /** Names the entry in the drawer's title: "the 08 Oct H-01 collection". */
  what: string;
  fields: EditField[];
  save: (values: Record<string, string>) => EditInput | string;
}) {
  const S = useErp();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  if (!S.isAdmin) return null;
  const submit = async () => {
    if (!values) return;
    const input = save(values);
    if (typeof input === "string") return setError(input);
    setError("");
    const r = await S.editEntry(input);
    if (!r.ok) return setError(r.error);
    setValues(null);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValues(Object.fromEntries(fields.map((f) => [f.key, f.value])));
          setError("");
        }}
        disabled={S.saving}
        title="Edit (admin)"
        className="rounded-md px-1.5 text-[12px] font-semibold text-[#055a5b] opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30"
      >
        Edit
      </button>
      <Drawer
        open={values !== null}
        onClose={() => setValues(null)}
        title={`Edit ${what}`}
        sub="A correction — the Activity log keeps what it was"
        onSubmit={() => void submit()}
        submitLabel="Save changes"
      >
        {values
          ? fields.map((f) =>
              f.options ? (
                <SelectField
                  key={f.key}
                  label={f.label}
                  value={values[f.key]}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                  options={f.options}
                />
              ) : (
                <TextField
                  key={f.key}
                  label={f.label}
                  type={f.type ?? "number"}
                  value={values[f.key]}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                />
              )
            )
          : null}
        <FormError message={error} />
      </Drawer>
    </>
  );
}

/** A whole number 0 or above from a text box, or null. */
export const wholeOf = (v: string) => (/^\d+$/.test(v.trim() || "0") ? Number(v.trim() || "0") : null);
/** A number above 0 from a text box, or null. */
export const amountOf = (v: string) => (Number(v) > 0 ? Number(v) : null);

// ── One edit form per kind of entry ─────────────────────────────────────────

const day = (value: string): EditField => ({ key: "date", label: "Date", type: "date", value });
/** Kg as bags, to two places. */
const bagsOf = (kg: number, bagKg: number) => String(Math.round((kg / bagKg) * 100) / 100);
/** Feed types to choose from; "Not specified" stays for entries from before types were kept. */
const feedType = (products: Product[], current?: number): EditField => ({
  key: "product",
  label: "Feed type",
  value: String(current ?? ""),
  options: [
    ...(current === undefined ? [{ label: "Not specified", value: "" }] : []),
    ...products.map((x) => ({ label: x.name, value: String(x.id) })),
  ],
});
const productOf = (v: string) => (v ? Number(v) : undefined);

export function EditProduction({ p }: { p: ProdEntry }) {
  const per = useErp().eggsPerCrate;
  return (
    <EditButton
      what={`the ${fmtD(p.date)} ${p.house} collection`}
      fields={[
        day(p.date),
        { key: "crates", label: "Crates", value: String(Math.floor(p.eggs / per)) },
        { key: "pieces", label: "Pieces", value: String(p.eggs % per) },
        { key: "cracked", label: "Cracked", value: String(p.cracked) },
        { key: "rejects", label: "Rejects", value: String(p.rejects) },
      ]}
      save={(v) => {
        const [crates, pieces, cracked, rejects] = [v.crates, v.pieces, v.cracked, v.rejects].map(wholeOf);
        if (crates === null || pieces === null || cracked === null || rejects === null) return "Enter whole numbers.";
        const eggs = crates * per + pieces;
        if (eggs <= 0) return "Enter the eggs collected.";
        if (cracked + rejects > eggs) return "Cracked + rejects can't exceed eggs collected.";
        return { kind: "production", id: p.id, date: v.date, eggs, cracked, rejects };
      }}
    />
  );
}

export function EditFeedUse({ u }: { u: FeedUse }) {
  const S = useErp();
  return (
    <EditButton
      what={`the ${fmtD(u.date)} ${u.house} feed entry`}
      fields={[day(u.date), { key: "bags", label: `Bags (${S.feedBagKg} kg)`, value: bagsOf(u.kg, S.feedBagKg) }, feedType(S.products, u.product)]}
      save={(v) => {
        const bags = amountOf(v.bags);
        if (bags === null) return "Enter the bags used.";
        return { kind: "feedUse", id: u.id, date: v.date, kg: bags * S.feedBagKg, product: productOf(v.product) };
      }}
    />
  );
}

/** A feed delivery bought in: Layers' own, or one of the other units'. */
export function EditDelivery({
  kind,
  d,
}: {
  kind: "layersFeedDelivery" | "broilerFeedDelivery";
  d: LayersFeedDelivery | BroilerFeedDelivery;
}) {
  const S = useErp();
  return (
    <EditButton
      what={`the ${fmtD(d.date)} delivery from ${d.supplier}`}
      fields={[
        day(d.date),
        { key: "supplier", label: "Supplier", type: "text", value: d.supplier },
        { key: "bags", label: `Bags (${S.feedBagKg} kg)`, value: bagsOf(d.kg, S.feedBagKg) },
        { key: "price", label: "Price per bag ₦", value: String(Math.round(d.pricePerKg * S.feedBagKg)) },
        feedType(S.products, d.product),
      ]}
      save={(v) => {
        const bags = amountOf(v.bags);
        if (!v.supplier.trim()) return "Enter the supplier.";
        if (bags === null) return "Enter the bags delivered.";
        if (!(Number(v.price) >= 0)) return "Enter the price per bag.";
        return {
          kind,
          id: d.id,
          date: v.date,
          supplier: v.supplier.trim(),
          kg: bags * S.feedBagKg,
          pricePerKg: Number(v.price) / S.feedBagKg,
          product: productOf(v.product),
        };
      }}
    />
  );
}

export function EditWater({ w }: { w: WaterLog }) {
  return (
    <EditButton
      what={`the ${fmtD(w.date)} ${w.house} water log`}
      fields={[day(w.date), { key: "litres", label: "Litres", value: String(w.litres) }]}
      save={(v) => {
        const litres = amountOf(v.litres);
        return litres === null ? "Enter the litres." : { kind: "water", id: w.id, date: v.date, litres };
      }}
    />
  );
}

/** Deaths and culls; birds sold are changed through their invoice. */
export function EditBirdOut({ o }: { o: BirdOut }) {
  if (o.reason === "sold") return null;
  return (
    <EditButton
      what={`the ${fmtD(o.date)} record for ${o.batch}`}
      fields={[
        day(o.date),
        { key: "birds", label: "Birds", value: String(o.birds) },
        {
          key: "reason",
          label: "Why",
          value: o.reason,
          options: [
            { label: "Died", value: "died" },
            { label: "Culled", value: "culled" },
          ],
        },
      ]}
      save={(v) => {
        const birds = wholeOf(v.birds);
        if (!birds) return "Enter a whole number of birds.";
        return { kind: "birdOut", id: o.id, date: v.date, birds, reason: v.reason as "died" | "culled" };
      }}
    />
  );
}

/** A crate movement: sorting in (good crates and cracks), opening stock, or crates out with a reason. */
export function EditEggMove({ m }: { m: EggMove }) {
  const per = useErp().eggsPerCrate;
  if (m.status !== "approved") return null;
  const sorting = m.type === "in" && m.reason !== "opening stock";
  return (
    <EditButton
      what={`this ${sorting ? "sorting" : m.type === "in" ? "opening stock" : "movement out"} of ${fmtD(m.date)}`}
      fields={[
        day(m.date),
        { key: "crates", label: sorting ? "Good crates" : "Crates", value: String(m.crates) },
        ...(sorting
          ? [
              { key: "crackCrates", label: "Cracked crates", value: String(Math.floor(m.cracked / per)) },
              { key: "crackPieces", label: "Cracked pieces", value: String(m.cracked % per) },
            ]
          : []),
        ...(m.type === "out" ? [{ key: "reason", label: "Reason", type: "text" as const, value: m.reason }] : []),
      ]}
      save={(v) => {
        const [crates, cc, cp] = [v.crates, v.crackCrates ?? "0", v.crackPieces ?? "0"].map(wholeOf);
        if (crates === null || cc === null || cp === null) return "Enter whole numbers.";
        const cracked = sorting ? cc * per + cp : 0;
        if (sorting ? crates + cracked <= 0 : crates <= 0) return "Enter the crates.";
        if (m.type === "out" && !v.reason.trim()) return "Say why the crates left.";
        return { kind: "eggMove", id: m.id, date: v.date, crates, cracked, reason: (v.reason ?? "").trim() };
      }}
    />
  );
}

/** Manure collected; a sale is changed through its invoice. */
export function EditManure({ m }: { m: ManureEntry }) {
  if (m.kind !== "produced" || m.invoiceId) return null;
  return (
    <EditButton
      what={`the ${fmtD(m.date)} manure entry`}
      fields={[day(m.date), { key: "bags", label: "Bags", value: String(m.bags) }]}
      save={(v) => {
        const bags = wholeOf(v.bags);
        return !bags ? "Enter a whole number of bags." : { kind: "manure", id: m.id, date: v.date, bags };
      }}
    />
  );
}

/** An expense or other income (Finance), or a unit's own expense. */
export function EditExpense({
  kind,
  e,
  categories,
}: {
  kind: "financeEntry" | "broilerExpense";
  e: { id: number; date: string; category: string; description: string; amount: number };
  categories: readonly { key: string; label: string }[];
}) {
  return (
    <EditButton
      what={`"${e.description}"`}
      fields={[
        day(e.date),
        { key: "category", label: "Category", value: e.category, options: categories.map((c) => ({ label: c.label, value: c.key })) },
        { key: "description", label: "Description", type: "text", value: e.description },
        { key: "amount", label: "Amount ₦", value: String(e.amount) },
      ]}
      save={(v) => {
        const amount = amountOf(v.amount);
        if (!v.description.trim()) return "Enter what it was for.";
        if (amount === null) return "Enter the amount.";
        return { kind, id: e.id, date: v.date, category: v.category, description: v.description.trim(), amount };
      }}
    />
  );
}

export function EditBroilerDaily({ r }: { r: BroilerDaily }) {
  const S = useErp();
  return (
    <EditButton
      what={`the ${fmtD(r.date)} ${r.batch} record`}
      fields={[
        day(r.date),
        { key: "bags", label: `Feed (bags of ${S.feedBagKg} kg)`, value: bagsOf(r.feedKg, S.feedBagKg) },
        feedType(S.products, r.product),
        { key: "litres", label: "Water (litres)", value: String(r.litres) },
        { key: "died", label: "Mortality", value: String(r.died) },
        { key: "culled", label: "Culls", value: String(r.culled) },
      ]}
      save={(v) => {
        const [died, culled] = [v.died, v.culled].map(wholeOf);
        const [bags, litres] = [Number(v.bags || 0), Number(v.litres || 0)];
        if (died === null || culled === null) return "Mortality and culls are whole numbers.";
        if (!(bags >= 0) || !(litres >= 0)) return "Figures can't be negative.";
        if (!bags && !litres && !died && !culled) return "Enter at least one figure — or delete the record.";
        if (bags > 0 && !v.product) return "Choose the feed type.";
        return {
          kind: "broilerDaily",
          id: r.id,
          date: v.date,
          feedKg: bags * S.feedBagKg,
          product: productOf(v.product),
          litres,
          died,
          culled,
        };
      }}
    />
  );
}

export function EditWeighing({ w }: { w: BroilerWeighing }) {
  return (
    <EditButton
      what={`the ${fmtD(w.date)} ${w.batch} weighing`}
      fields={[
        day(w.date),
        { key: "birds", label: "Birds weighed", value: String(w.birds) },
        { key: "kg", label: "Their weight (kg)", value: String(w.kg) },
      ]}
      save={(v) => {
        const birds = wholeOf(v.birds);
        const kg = amountOf(v.kg);
        if (!birds) return "Enter the birds weighed.";
        if (kg === null) return "Enter their weight together, in kg.";
        return { kind: "broilerWeighing", id: w.id, date: v.date, birds, kg };
      }}
    />
  );
}

export function EditRuminantFeed({ f }: { f: RuminantFeed }) {
  const S = useErp();
  return (
    <EditButton
      what={`the ${fmtD(f.date)} feed given`}
      fields={[day(f.date), { key: "bags", label: `Bags (${S.feedBagKg} kg)`, value: bagsOf(f.kg, S.feedBagKg) }, feedType(S.products, f.product)]}
      save={(v) => {
        const bags = amountOf(v.bags);
        if (bags === null) return "Enter the bags given.";
        return { kind: "ruminantFeed", id: f.id, date: v.date, kg: bags * S.feedBagKg, product: productOf(v.product) };
      }}
    />
  );
}

export function EditAnimalWeight({ w, tag }: { w: AnimalWeight; tag: string }) {
  return (
    <EditButton
      what={`the ${fmtD(w.date)} weight of ${tag}`}
      fields={[day(w.date), { key: "kg", label: "Weight (kg)", value: String(w.kg) }]}
      save={(v) => {
        const kg = amountOf(v.kg);
        return kg === null ? "Enter its weight in kg." : { kind: "animalWeight", id: w.id, date: v.date, kg };
      }}
    />
  );
}
