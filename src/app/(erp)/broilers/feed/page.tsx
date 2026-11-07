"use client";

import { useState } from "react";

import { broilerFeedPosition } from "@/lib/erp/broilers";
import { isDivisionBuyer } from "@/lib/erp/divisions";
import { feedByType, fmtBags, fmtD, fmtK, fmtN, millFeed } from "@/lib/erp/derive";
import { FeedStockCard, feedTypeName } from "@/components/erp/FeedTypes";
import { useBirdUnit } from "@/components/erp/useUnit";
import { Card, CardTitle, DeleteButton, Kpi, Note, PageHeader, Recorded, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";
import { DayField, Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";

const blank = { supplier: "", bags: "", price: "", date: "", product: "" };

/** Broiler feed: bought in and from the mill, less what the batches ate. */
export default function BroilerFeed() {
  const S = useBirdUnit();
  const bagKg = S.feedBagKg;
  const bags = (kg: number) => fmtBags(kg, bagKg);
  const pos = broilerFeedPosition(S, S.today, S.unit);
  const byType = feedByType(S.products, [...S.broilerFeedDeliveries, ...millFeed(S.feedSales, S.products, S.unit)], S.broilerDaily.map((r) => ({ product: r.product, kg: r.feedKg })));
  const used = S.broilerDaily.filter((r) => r.feedKg > 0);
  const mill = S.feedSales
    .filter((s) => s.channel === "internal" && isDivisionBuyer(s.buyer, S.unit))
    .sort((a, b) => b.date.localeCompare(a.date));
  const usedPage = usePaged(used);
  const millPage = usePaged(mill);
  const delivPage = usePaged(S.broilerFeedDeliveries);

  const [form, setForm] = useState<typeof blank | null>(null);
  const [error, setError] = useState("");
  const save = async () => {
    if (!form) return;
    const n = Number(form.bags);
    const price = Number(form.price);
    if (!form.supplier.trim()) return setError("Enter the supplier.");
    if (!(n > 0)) return setError("Enter the bags delivered.");
    if (!(price > 0)) return setError("Enter the price per bag.");
    const product = Number(form.product || S.products[0]?.id || 0);
    if (!product) return setError("Add a feed type on Feed mill → Products first.");
    const r = await S.addBroilerFeedDelivery({ supplier: form.supplier.trim(), kg: n * bagKg, pricePerKg: price / bagKg, product, unit: S.unit, date: form.date || undefined });
    if (!r.ok) return setError(r.error);
    setForm(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={S.u.label}
        title="Feed"
        sub="Feed bought in and from the mill, less what the batches ate"
        action={
          <NewButton
            onClick={() => {
              setForm(blank);
              setError("");
            }}
          >
            Record delivery
          </NewButton>
        }
      />

      <Drawer open={form !== null} onClose={() => setForm(null)} title="Record delivery" sub="Feed bought outside — the mill's transfers arrive on their own" onSubmit={() => void save()} submitLabel="Record delivery">
        {form ? (
          <>
            <TextField label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} placeholder="AgroFeeds Ltd" />
            <FieldRow>
              <TextField label={`Bags (${bagKg} kg)`} type="number" value={form.bags} onChange={(v) => setForm({ ...form, bags: v })} placeholder="100" />
              <TextField label="Price per bag ₦" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="15500" />
            </FieldRow>
            <SelectField
              label="Feed type"
              value={form.product || String(S.products[0]?.id ?? "")}
              onChange={(v) => setForm({ ...form, product: v })}
              options={S.products.map((p) => ({ label: p.name, value: String(p.id) }))}
            />
            <DayField label="Delivered on" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </>
        ) : null}
        <FormError message={error} />
      </Drawer>

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="Feed stock"
          value={bags(pos.stockKg)}
          formula={`${bags(pos.external)} bought + ${bags(pos.fromMill)} mill − ${bags(pos.used)} used`}
          color={pos.stockKg < 0 ? "#c7402f" : "#055a5b"}
        />
        <Kpi label="Used today" value={bags(pos.usedToday)} sub={`${fmtK(pos.usedToday)} kg`} color="#9a6a12" />
        <Kpi label="Days cover" value={String(pos.daysCover)} sub="at the last 7 days' pace" />
        <Kpi label="From mill" value={bags(pos.fromMill)} sub="sent by the feed mill" color="#3a8bd6" />
      </div>

      <FeedStockCard rows={byType} bagKg={bagKg} />

      <div className="stagger mt-4 flex flex-col gap-3.5">
        <Card className="overflow-hidden">
          <div className="px-4 pt-3.5">
            <CardTitle>Feed used</CardTitle>
          </div>
          <div className="mt-2">
            <Table pager={usedPage.pager}>
              <THead>
                <Th>Date</Th>
                <Th>Batch</Th>
                <Th>Feed type</Th>
                <Th right>Bags</Th>
              </THead>
              <tbody>
                {used.length === 0 ? (
                  <TRow>
                    <Td colSpan={4} className="text-[#84908f]">
                      Feed used is entered on Daily entry.
                    </Td>
                  </TRow>
                ) : null}
                {usedPage.rows.map((r) => (
                  <TRow key={r.id}>
                    <Td>
                      {fmtD(r.date)}
                      <Recorded at={r.createdAt} date={r.date} />
                    </Td>
                    <Td className="font-semibold">{r.batch}</Td>
                    <Td>{feedTypeName(S.products, r.product)}</Td>
                    <Td right>
                      {bags(r.feedKg)}
                      <div className="text-[11.5px] text-[#84908f]">{fmtK(r.feedKg)} kg</div>
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
                <Th right>Kg</Th>
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
                    <Td right>{fmtK(s.bags * (S.products.find((p) => p.id === s.product)?.bag ?? 0))}</Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
      <Note>
        Feed is counted in bags of {bagKg} kg (the bag size is in Settings). Ask the mill for feed on Feed requests; what
        it sends is added here on its own.
      </Note>
    </>
  );
}
