"use client";

import { useState } from "react";

import { broilersAlive, fmtKg, partsInStore } from "@/lib/erp/broilers";
import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { DeleteButton, Card, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { batch: "", birds: "", liveKg: "", carcassKg: "", headFeetKg: "", gizzardKg: "", cost: "", date: "" };
const pctOf = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(1)}%` : "—");

/** Birds processed: live weight in; carcass, head and feet and gizzard out, into store for sale. */
export default function BroilerProcessing() {
  const S = useErp();
  const rows = S.broilerProcessing;
  const paged = usePaged(rows);
  const store = partsInStore(S);
  const active = S.broilerBatches.filter((b) => b.st === "active");
  const alive = (code: string) => {
    const b = S.broilerBatches.find((x) => x.batch === code);
    return b ? broilersAlive(b, S) : 0;
  };
  const month = S.today.slice(0, 7);
  const thisMonth = rows.filter((p) => p.date.slice(0, 7) === month);
  const live = thisMonth.reduce((a, p) => a + p.liveKg, 0);
  const carcass = thisMonth.reduce((a, p) => a + p.carcassKg, 0);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const batch = form?.batch || active[0]?.batch || "";
  const n = (v?: string) => (v && v.trim() ? Number(v) : 0);
  const save = async () => {
    if (!form) return;
    const birds = n(form.birds);
    if (!batch) return setError("Add a batch first.");
    if (!Number.isInteger(birds) || birds <= 0) return setError("Enter the birds processed.");
    if (birds > alive(batch)) return setError(`${batch} only has ${fmtK(alive(batch))} birds.`);
    if (!(n(form.liveKg) > 0)) return setError("Enter their live weight, in kg.");
    if (!(n(form.carcassKg) > 0)) return setError("Enter the carcass weight after processing.");
    if ([form.headFeetKg, form.gizzardKg, form.cost].map(n).some((x) => x < 0)) return setError("Figures can't be negative.");
    if (n(form.carcassKg) + n(form.headFeetKg) + n(form.gizzardKg) > n(form.liveKg)) {
      return setError("What came out can't weigh more than the live birds.");
    }
    const r = await S.processBroilers({
      batch,
      birds,
      liveKg: n(form.liveKg),
      carcassKg: n(form.carcassKg),
      headFeetKg: n(form.headFeetKg),
      gizzardKg: n(form.gizzardKg),
      cost: n(form.cost),
      date: form.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Broilers"
        title="Processing"
        sub="Live birds in; carcass, head and feet and gizzard out, ready to sell"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Record processing
          </NewButton>
        }
      />

      <Drawer
        open={form !== null}
        onClose={() => setForm(null)}
        title="Record processing"
        sub="The birds come off their batch; what they give goes into store"
        onSubmit={() => void save()}
        submitLabel="Record"
      >
        {form ? (
          <>
            <SelectField
              label="Batch"
              value={batch}
              onChange={(v) => setForm({ ...form, batch: v })}
              options={active.map((b) => ({ label: `${b.batch} (${fmtK(alive(b.batch))} birds)`, value: b.batch }))}
            />
            <FieldRow>
              <TextField label="Birds" type="number" value={form.birds} onChange={(v) => setForm({ ...form, birds: v })} placeholder="200" />
              <TextField label="Live weight (kg)" type="number" value={form.liveKg} onChange={(v) => setForm({ ...form, liveKg: v })} placeholder="480" />
            </FieldRow>
            <TextField label="Carcass weight (kg)" type="number" value={form.carcassKg} onChange={(v) => setForm({ ...form, carcassKg: v })} placeholder="350" />
            <FieldRow>
              <TextField label="Head and feet (kg)" type="number" value={form.headFeetKg} onChange={(v) => setForm({ ...form, headFeetKg: v })} placeholder="30" />
              <TextField label="Gizzard (kg)" type="number" value={form.gizzardKg} onChange={(v) => setForm({ ...form, gizzardKg: v })} placeholder="12" />
            </FieldRow>
            {n(form.liveKg) > 0 && n(form.carcassKg) > 0 ? (
              <div className="-mt-1 text-[13px] text-[#465657]">
                Carcass is <span className="font-semibold">{pctOf(n(form.carcassKg), n(form.liveKg))}</span> of live weight
                {n(form.birds) > 0 ? ` · ${fmtKg(n(form.carcassKg) / n(form.birds), 2)} a bird` : ""}
              </div>
            ) : null}
            <TextField label="Cost of processing ₦" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} placeholder="40000" />
            <DayField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {store.map((p) => (
          <Kpi key={p.key} label={`${p.label} in store`} value={fmtKg(p.stock, 1)} sub={`${fmtKg(p.sold, 1)} sold so far`} color="#055a5b" />
        ))}
        <Kpi label="Yield this month" value={pctOf(carcass, live)} sub={`${fmtKg(carcass, 0)} carcass from ${fmtKg(live, 0)} live`} />
      </div>

      <Card className="overflow-hidden [&_td]:px-2.5 [&_th]:px-2.5">
        <Table pager={paged.pager}>
          <THead>
            <Th>Date</Th>
            <Th>Batch</Th>
            <Th right>Birds</Th>
            <Th right>Live</Th>
            <Th right>Carcass</Th>
            <Th right>Head and feet</Th>
            <Th right>Gizzard</Th>
            <Th right>Cost</Th>
            <Th right />
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TRow>
                <Td colSpan={9} className="text-[#84908f]">
                  No birds processed yet.
                </Td>
              </TRow>
            ) : null}
            {paged.rows.map((p) => (
              <TRow key={p.id}>
                <Td>
                  {fmtD(p.date)}
                  <Recorded at={p.createdAt} date={p.date} />
                </Td>
                <Td className="font-semibold">{p.batch}</Td>
                <Td right>{fmtK(p.birds)}</Td>
                <Td right>{fmtKg(p.liveKg, 1)}</Td>
                <Td right>
                  {fmtKg(p.carcassKg, 1)}
                  <div className="text-[11.5px] text-[#84908f]">{pctOf(p.carcassKg, p.liveKg)} yield</div>
                </Td>
                <Td right>{fmtKg(p.headFeetKg, 1)}</Td>
                <Td right>{fmtKg(p.gizzardKg, 1)}</Td>
                <Td right>
                  {fmtN(p.cost)}
                  {p.carcassKg ? <div className="text-[11.5px] text-[#84908f]">{fmtN(p.cost / p.carcassKg)}/kg</div> : null}
                </Td>
                <Td right>
                  <DeleteButton
                    kind="broilerProcessing"
                    id={p.id}
                    what={`the ${fmtD(p.date)} processing of ${p.birds} birds`}
                    body="The birds go back to their batch and the carcass and parts leave the store. Refused if any were sold."
                  />
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        Yield is carcass ÷ live weight. The carcass, head and feet and gizzard are sold from store on Broilers → Sales,
        by the kg (or carcass by the bird). The cost of processing counts in the batch&apos;s costs on Analysis.
      </Note>
    </>
  );
}
