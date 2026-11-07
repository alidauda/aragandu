"use client";

import { useState } from "react";

import { SPECIES, speciesOf } from "@/lib/erp/broilers";
import { animalAge, gainPerDay, weightsOf } from "@/lib/erp/ruminants";
import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import type { Animal } from "@/lib/erp/types";
import { confirmDialog } from "@/components/Dialogs";
import { Badge, Card, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const input = "rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#055a5b]";
const small = "rounded-md px-1.5 text-[12.5px] font-semibold";
const STATUS: Record<Animal["status"], { bg: string; fg: string; label: string }> = {
  active: { bg: "#e3efee", fg: "#044647", label: "on farm" },
  sold: { bg: "#e2f0ed", fg: "#016559", label: "sold" },
  died: { bg: "#fbeae7", fg: "#c7402f", label: "died" },
  culled: { bg: "#fcf2de", fg: "#9a6a12", label: "culled" },
};
const blankAnimal = { id: 0, tag: "", species: "goat", sex: "female", breed: "", born: "", pen: "", purchaseCost: "", notes: "", date: "" };

/** Every animal by its tag: bought, born, weighed, treated, sold or lost. */
export default function RuminantAnimals() {
  const S = useErp();
  const admin = S.canDo("ruminants", "admin");
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState("");
  const [status, setStatus] = useState("active");
  const shown = S.animals.filter(
    (a) =>
      (!species || a.species === species) &&
      (!status || a.status === status) &&
      (!q.trim() || `${a.tag} ${a.breed} ${a.pen} ${a.dam}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const paged = usePaged(shown, `${q}|${species}|${status}`);
  const lastKg = (a: Animal) => weightsOf(a, S.animalWeights)[0]?.kg;

  // Add or edit an animal.
  const [form, setForm] = useState<typeof blankAnimal | null>(null);
  const [error, setError] = useState("");
  const saveAnimal = async () => {
    if (!form) return;
    if (!form.tag.trim()) return setError("Enter the tag.");
    const cost = Number(form.purchaseCost || 0);
    if (!Number.isInteger(cost) || cost < 0) return setError("Enter the cost in whole naira.");
    const fields = {
      tag: form.tag.trim(),
      species: form.species as "goat",
      sex: form.sex as "female",
      breed: form.breed.trim(),
      pen: form.pen.trim(),
      purchaseCost: cost,
      notes: form.notes.trim(),
    };
    const r = form.id
      ? await S.updateAnimal({ id: form.id, ...fields, born: form.born || null })
      : await S.addAnimal({ ...fields, born: form.born || undefined, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  // Births.
  const [birth, setBirth] = useState<{ dam: string; young: { tag: string; sex: string }[]; date: string } | null>(null);
  const dams = S.animals.filter((a) => a.status === "active" && a.sex === "female");
  const saveBirth = async () => {
    if (!birth) return;
    const dam = birth.dam || dams[0]?.tag || "";
    if (!dam) return setError("There's no female on the farm to record a birth for.");
    if (birth.young.some((y) => !y.tag.trim())) return setError("Give each one a tag.");
    const r = await S.recordBirth({
      dam,
      young: birth.young.map((y) => ({ tag: y.tag.trim(), sex: y.sex as "female" })),
      date: birth.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setBirth(null);
  };

  // Died or culled.
  const [left, setLeft] = useState<{ animal: Animal; status: string; note: string; date: string } | null>(null);
  const saveLeft = async () => {
    if (!left) return;
    const r = await S.animalLeft({ animals: [left.animal.id], status: left.status as "died", note: left.note.trim(), date: left.date || undefined });
    if (!r.ok) return setError(r.error);
    setLeft(null);
  };

  // Viewing one animal.
  const [viewId, setViewId] = useState<number | null>(null);
  const viewing = S.animals.find((a) => a.id === viewId);

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Animals"
        sub="Every animal by its tag"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBirth({ dam: "", young: [{ tag: "", sex: "female" }], date: "" });
                setError("");
              }}
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
            >
              Record birth
            </button>
            <NewButton
              onClick={() => {
                setForm(blankAnimal);
                setError("");
              }}
            >
              Add animal
            </NewButton>
          </div>
        }
      />

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `Edit ${S.animals.find((a) => a.id === form.id)?.tag ?? ""}` : "Add animal"}
        sub={form?.id ? "Corrections" : "Bought in, or already on the farm"}
        onSubmit={() => void saveAnimal()}
        submitLabel="Save"
      >
        {form ? (
          <>
            <FieldRow>
              <TextField label="Tag" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="G-014" />
              <SelectField label="Species" value={form.species} onChange={(v) => setForm({ ...form, species: v })} options={SPECIES.map((s) => ({ label: s.one, value: s.key }))} />
            </FieldRow>
            <FieldRow>
              <SelectField
                label="Sex"
                value={form.sex}
                onChange={(v) => setForm({ ...form, sex: v })}
                options={[
                  { label: "Female", value: "female" },
                  { label: "Male", value: "male" },
                ]}
              />
              <TextField label="Breed" value={form.breed} onChange={(v) => setForm({ ...form, breed: v })} placeholder="Red Sokoto" />
            </FieldRow>
            <FieldRow>
              <TextField label="Born (if known)" type="date" value={form.born} onChange={(v) => setForm({ ...form, born: v })} />
              <TextField label="Pen" value={form.pen} onChange={(v) => setForm({ ...form, pen: v })} placeholder="Pen A" />
            </FieldRow>
            <TextField label="Cost of buying ₦ (if bought)" type="number" value={form.purchaseCost} onChange={(v) => setForm({ ...form, purchaseCost: v })} />
            <TextField label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
            {form.id ? null : <DayField label="Joined the farm" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />}
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer open={birth !== null} onClose={() => setBirth(null)} title="Record birth" sub="Each one born gets its own tag" onSubmit={() => void saveBirth()} submitLabel="Record">
        {birth ? (
          <>
            <SelectField
              label="Mother"
              value={birth.dam || dams[0]?.tag || ""}
              onChange={(v) => setBirth({ ...birth, dam: v })}
              options={dams.map((a) => ({ label: `${a.tag} · ${speciesOf(a.species).one}${a.pen ? ` · ${a.pen}` : ""}`, value: a.tag }))}
            />
            {birth.young.map((y, i) => (
              <FieldRow key={i}>
                <TextField
                  label={`Young ${i + 1} — tag`}
                  value={y.tag}
                  onChange={(v) => setBirth({ ...birth, young: birth.young.map((x, j) => (j === i ? { ...x, tag: v } : x)) })}
                />
                <SelectField
                  label="Sex"
                  value={y.sex}
                  onChange={(v) => setBirth({ ...birth, young: birth.young.map((x, j) => (j === i ? { ...x, sex: v } : x)) })}
                  options={[
                    { label: "Female", value: "female" },
                    { label: "Male", value: "male" },
                  ]}
                />
              </FieldRow>
            ))}
            <div className="flex gap-3 text-[13px] font-semibold">
              <button type="button" onClick={() => setBirth({ ...birth, young: [...birth.young, { tag: "", sex: "female" }] })} className="text-[#055a5b] underline">
                Add another
              </button>
              {birth.young.length > 1 ? (
                <button type="button" onClick={() => setBirth({ ...birth, young: birth.young.slice(0, -1) })} className="text-[#c7402f] underline">
                  Remove last
                </button>
              ) : null}
            </div>
            <DayField label="Born on" value={birth.date} onChange={(v) => setBirth({ ...birth, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer open={left !== null} onClose={() => setLeft(null)} title={`${left?.animal.tag ?? ""} died or was culled`} sub="It leaves the herd" onSubmit={() => void saveLeft()} submitLabel="Record">
        {left ? (
          <>
            <SelectField
              label="What happened"
              value={left.status}
              onChange={(v) => setLeft({ ...left, status: v })}
              options={[
                { label: "Died", value: "died" },
                { label: "Culled", value: "culled" },
              ]}
            />
            <TextField label="Cause or reason (optional)" value={left.note} onChange={(v) => setLeft({ ...left, note: v })} />
            <DayField value={left.date} onChange={(v) => setLeft({ ...left, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer open={viewing !== undefined} onClose={() => setViewId(null)} title={viewing ? `${viewing.tag} · ${speciesOf(viewing.species).one}` : ""} sub={viewing ? `${viewing.sex}, ${animalAge(viewing.born, S.today)} old` : ""} onSubmit={() => setViewId(null)} submitLabel="Done">
        {viewing ? (
          <div className="flex flex-col gap-3 text-[13.5px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[#f4f6f5] px-4 py-3">
              <span className="text-[#738080]">Breed</span>
              <span>{viewing.breed || "—"}</span>
              <span className="text-[#738080]">Pen</span>
              <span>{viewing.pen || "—"}</span>
              <span className="text-[#738080]">{viewing.source === "born" ? "Born here to" : "Bought"}</span>
              <span>{viewing.source === "born" ? viewing.dam : `${fmtD(viewing.joined)}${viewing.purchaseCost ? ` · ${fmtN(viewing.purchaseCost)}` : ""}`}</span>
              <span className="text-[#738080]">Status</span>
              <span>
                {STATUS[viewing.status].label}
                {viewing.leftOn ? ` ${fmtD(viewing.leftOn)}` : ""}
                {viewing.leftNote ? ` — ${viewing.leftNote}` : ""}
              </span>
            </div>
            <div>
              <div className="mb-1 font-semibold text-[#465657]">Weights</div>
              {weightsOf(viewing, S.animalWeights).length === 0 ? <div className="text-[#84908f]">Not weighed yet.</div> : null}
              {weightsOf(viewing, S.animalWeights).slice(0, 8).map((w) => (
                <div key={w.id} className="flex justify-between border-t border-[#ebf0ef] py-1.5">
                  <span>{fmtD(w.date)}</span>
                  <span className="font-semibold">{w.kg} kg</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 font-semibold text-[#465657]">Health</div>
              {S.animalHealth.filter((h) => h.animal === viewing.id).length === 0 ? <div className="text-[#84908f]">Nothing recorded.</div> : null}
              {S.animalHealth
                .filter((h) => h.animal === viewing.id)
                .slice(0, 8)
                .map((h) => (
                  <div key={h.id} className="flex justify-between border-t border-[#ebf0ef] py-1.5">
                    <span>
                      {fmtD(h.date)} · {h.product}
                    </span>
                    <span className="text-[#84908f]">{h.kind}</span>
                  </div>
                ))}
            </div>
            {S.animals.some((a) => a.dam === viewing.tag) ? (
              <div>
                <div className="mb-1 font-semibold text-[#465657]">Young</div>
                <div>{S.animals.filter((a) => a.dam === viewing.tag).map((a) => a.tag).join(", ")}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Card className="mb-4 flex flex-wrap items-center gap-2 px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, breed, pen, mother" aria-label="Search" className={`${input} min-w-[220px] flex-1`} />
        <select aria-label="Species" value={species} onChange={(e) => setSpecies(e.target.value)} className={input}>
          <option value="">All species</option>
          {SPECIES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="active">On the farm</option>
          <option value="sold">Sold</option>
          <option value="died">Died</option>
          <option value="culled">Culled</option>
          <option value="">All</option>
        </select>
      </Card>

      <Card className="overflow-hidden">
        <Table pager={paged.pager}>
          <THead>
            <Th>Tag</Th>
            <Th>Sex</Th>
            <Th right>Age</Th>
            <Th>Pen</Th>
            <Th right>Weight</Th>
            <Th>Status</Th>
            <Th right />
          </THead>
          <tbody>
            {shown.length === 0 ? (
              <TRow>
                <Td colSpan={7} className="text-[#84908f]">
                  {S.animals.length ? "No animals match." : "No animals yet — add them, or record a birth."}
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((a) => {
              const kg = lastKg(a);
              const gain = gainPerDay(a, S.animalWeights);
              const st = STATUS[a.status];
              return (
                <TRow key={a.id}>
                  <Td>
                    <span className="font-semibold">{a.tag}</span>
                    <div className="text-[12px] text-[#84908f]">
                      {speciesOf(a.species).one}
                      {a.breed ? ` · ${a.breed}` : ""}
                      {a.dam ? ` · of ${a.dam}` : ""}
                    </div>
                  </Td>
                  <Td className="capitalize">{a.sex}</Td>
                  <Td right>{animalAge(a.born, S.today)}</Td>
                  <Td>{a.pen || "—"}</Td>
                  <Td right>
                    {kg !== undefined ? `${kg} kg` : "—"}
                    {gain !== null ? <div className="text-[11.5px] text-[#84908f]">{Math.round(gain)} g a day</div> : null}
                  </Td>
                  <Td>
                    <Badge label={st.label} bg={st.bg} fg={st.fg} />
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <button type="button" onClick={() => setViewId(a.id)} className={`${small} text-[#055a5b]`}>
                      View
                    </button>
                    {a.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLeft({ animal: a, status: "died", note: "", date: "" });
                          setError("");
                        }}
                        className={`${small} text-[#9a6a12]`}
                      >
                        Died / culled
                      </button>
                    ) : null}
                    {admin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            id: a.id,
                            tag: a.tag,
                            species: a.species,
                            sex: a.sex,
                            breed: a.breed,
                            born: a.born ?? "",
                            pen: a.pen,
                            purchaseCost: a.purchaseCost ? String(a.purchaseCost) : "",
                            notes: a.notes,
                            date: "",
                          });
                          setError("");
                        }}
                        className={`${small} text-[#055a5b]`}
                      >
                        Edit
                      </button>
                    ) : null}
                    {admin && a.status !== "sold" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirmDialog({ title: `Delete ${a.tag}?`, body: "Its weights and health records go with it.", confirmLabel: "Delete", danger: true }))
                            void S.deleteEntry("animal", a.id);
                        }}
                        className={`${small} text-[#c7402f] opacity-70 hover:opacity-100`}
                      >
                        Delete
                      </button>
                    ) : null}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        {fmtK(S.animals.filter((a) => a.status === "active").length)} on the farm. Animals sold leave the herd on Sales; deleting
        that invoice brings them back.
      </Note>
    </>
  );
}
