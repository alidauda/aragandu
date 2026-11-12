"use client";

import { useState } from "react";

import { SPECIES, speciesOf } from "@/lib/erp/broilers";
import { isDivisionBuyer } from "@/lib/erp/divisions";
import { feedByType, fmtBags, fmtD, fmtK, fmtN, millFeed } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { FeedStockCard, feedTypeName } from "@/components/erp/FeedTypes";
import { Card, CardTitle, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SecondButton, SelectField, TextField } from "@/components/erp/Drawer";

/** Feed for the herd: bought in and from the mill, less what each species ate. */
export default function RuminantFeed() {
  const S = useErp();
  const bagKg = S.feedBagKg;
  const bags = (kg: number) => fmtBags(kg, bagKg);
  const deliveries = S.broilerFeedDeliveries.filter((d) => d.unit === "ruminants");
  const mill = S.feedSales.filter((s) => s.channel === "internal" && isDivisionBuyer(s.buyer, "ruminants"));
  const byType = feedByType(S.products, [...deliveries, ...millFeed(S.feedSales, S.products, "ruminants")], S.ruminantFeed);
  const stock = byType.reduce((a, r) => a + r.stock, 0);
  const usedPage = usePaged(S.ruminantFeed);
  const delivPage = usePaged(deliveries);
  const millPage = usePaged(mill);
  const firstType = String(S.products[0]?.id ?? "");

  const [give, setGive] = useState<{ species: string; product: string; bags: string; date: string } | null>(null);
  const [deliv, setDeliv] = useState<{ supplier: string; product: string; bags: string; price: string; date: string } | null>(null);
  const [error, setError] = useState("");
  const saveGive = async () => {
    if (!give) return;
    const n = Number(give.bags);
    if (!(n > 0)) return setError("Enter the bags given.");
    const r = await S.addRuminantFeed({ species: give.species as "goat", kg: n * bagKg, product: Number(give.product || firstType), date: give.date || undefined });
    if (!r.ok) return setError(r.error);
    setGive(null);
  };
  const saveDeliv = async () => {
    if (!deliv) return;
    const n = Number(deliv.bags);
    const price = Number(deliv.price);
    if (!deliv.supplier.trim()) return setError("Enter the supplier.");
    if (!(n > 0)) return setError("Enter the bags delivered.");
    if (!(price > 0)) return setError("Enter the price per bag.");
    const r = await S.addBroilerFeedDelivery({
      supplier: deliv.supplier.trim(),
      kg: n * bagKg,
      pricePerKg: price / bagKg,
      product: Number(deliv.product || firstType),
      unit: "ruminants",
      date: deliv.date || undefined,
    });
    if (!r.ok) return setError(r.error);
    setDeliv(null);
  };
  const typeOptions = S.products.map((p) => ({ label: p.name, value: String(p.id) }));

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Feed"
        sub="Feed bought in and from the mill, less what each species ate"
        action={
          <div className="flex flex-wrap gap-2">
            <SecondButton onClick={() => {
                setDeliv({ supplier: "", product: "", bags: "", price: "", date: "" });
                setError("");
              }}>Record delivery</SecondButton>
            <NewButton
              onClick={() => {
                setGive({ species: "goat", product: "", bags: "", date: "" });
                setError("");
              }}
            >
              Record feed given
            </NewButton>
          </div>
        }
      />

      <Drawer open={give !== null} onClose={() => setGive(null)} title="Record feed given" sub="What a species ate on a day" onSubmit={() => void saveGive()} submitLabel="Record">
        {give ? (
          <>
            <FieldRow>
              <SelectField label="Species" value={give.species} onChange={(v) => setGive({ ...give, species: v })} options={SPECIES.map((s) => ({ label: s.label, value: s.key }))} />
              <SelectField label="Feed type" value={give.product || firstType} onChange={(v) => setGive({ ...give, product: v })} options={typeOptions} />
            </FieldRow>
            <TextField label={`Bags (${bagKg} kg)`} type="number" value={give.bags} onChange={(v) => setGive({ ...give, bags: v })} placeholder="2" />
            <DayField value={give.date} onChange={(v) => setGive({ ...give, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <Drawer open={deliv !== null} onClose={() => setDeliv(null)} title="Record delivery" sub="Feed bought outside — the mill's transfers arrive on their own" onSubmit={() => void saveDeliv()} submitLabel="Record delivery">
        {deliv ? (
          <>
            <TextField label="Supplier" value={deliv.supplier} onChange={(v) => setDeliv({ ...deliv, supplier: v })} />
            <FieldRow>
              <TextField label={`Bags (${bagKg} kg)`} type="number" value={deliv.bags} onChange={(v) => setDeliv({ ...deliv, bags: v })} />
              <TextField label="Price per bag ₦" type="number" value={deliv.price} onChange={(v) => setDeliv({ ...deliv, price: v })} />
            </FieldRow>
            <SelectField label="Feed type" value={deliv.product || firstType} onChange={(v) => setDeliv({ ...deliv, product: v })} options={typeOptions} />
            <DayField label="Delivered on" value={deliv.date} onChange={(v) => setDeliv({ ...deliv, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Kpi label="Feed stock" value={bags(stock)} color={stock < 0 ? "#c7402f" : "#055a5b"} />
        <Kpi label="Given today" value={bags(S.ruminantFeed.filter((f) => f.date === S.today).reduce((a, f) => a + f.kg, 0))} color="#9a6a12" />
        <Kpi label="From mill" value={bags(millFeed(S.feedSales, S.products, "ruminants").reduce((a, x) => a + x.kg, 0))} color="#3a8bd6" />
      </div>
      <FeedStockCard rows={byType} bagKg={bagKg} />

      <div className="mt-4 flex flex-col gap-3.5">
        <Card className="overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>Feed given</CardTitle>
          </div>
          <div className="mt-2">
            <Table pager={usedPage.pager}>
              <THead>
                <Th>Date</Th>
                <Th>Species</Th>
                <Th>Feed type</Th>
                <Th right>Bags</Th>
                <Th right />
              </THead>
              <tbody>
                {S.ruminantFeed.length === 0 ? (
                  <TRow>
                    <Td colSpan={5} className="text-[#84908f]">
                      Nothing given yet.
                    </Td>
                  </TRow>
                ) : null}
                {usedPage.rows.map((f) => (
                  <TRow key={f.id}>
                    <Td>
                      {fmtD(f.date)}
                      <Recorded at={f.createdAt} date={f.date} />
                    </Td>
                    <Td className="font-semibold">{speciesOf(f.species).label}</Td>
                    <Td>{feedTypeName(S.products, f.product)}</Td>
                    <Td right>
                      {bags(f.kg)}
                      <div className="text-[11.5px] text-[#84908f]">{fmtK(f.kg)} kg</div>
                    </Td>
                    <Td right>
                      <DeleteButton kind="ruminantFeed" id={f.id} what={`the ${fmtD(f.date)} feed for ${speciesOf(f.species).label.toLowerCase()}`} />
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>Deliveries</CardTitle>
          </div>
          <div className="mt-2">
            <Table pager={delivPage.pager}>
              <THead>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th>Feed type</Th>
                <Th right>Bags</Th>
                <Th right>₦/bag</Th>
                <Th right />
              </THead>
              <tbody>
                {delivPage.rows.map((d) => (
                  <TRow key={d.id}>
                    <Td>
                      {fmtD(d.date)}
                      <Recorded at={d.createdAt} date={d.date} />
                    </Td>
                    <Td>{d.supplier}</Td>
                    <Td>{feedTypeName(S.products, d.product)}</Td>
                    <Td right>{bags(d.kg)}</Td>
                    <Td right>{d.pricePerKg ? fmtN(d.pricePerKg * bagKg) : "—"}</Td>
                    <Td right>
                      <DeleteButton kind="broilerFeedDelivery" id={d.id} what={`the ${fmtD(d.date)} delivery from ${d.supplier}`} />
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>From the mill</CardTitle>
          </div>
          <div className="mt-2">
            <Table pager={millPage.pager}>
              <THead>
                <Th>Date</Th>
                <Th>Feed type</Th>
                <Th right>Bags</Th>
              </THead>
              <tbody>
                {millPage.rows.map((s) => (
                  <TRow key={s.id}>
                    <Td>
                      {fmtD(s.date)}
                      <Recorded at={s.createdAt} date={s.date} />
                    </Td>
                    <Td>{feedTypeName(S.products, s.product)}</Td>
                    <Td right>{s.bags}</Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
      <Note>Feed of a type can&apos;t be given beyond what&apos;s on hand of it. Ask the mill on Feed requests.</Note>
    </>
  );
}
