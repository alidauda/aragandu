"use client";

import Link from "next/link";

import { SPECIES } from "@/lib/erp/broilers";
import { feedByType, fmtBags, fmtK, millFeed } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import { Card, CardTitle, Kpi, Note, PageHeader, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

/** The herd at a glance: animals by species and sex, and this month's comings and goings. */
export default function RuminantsOverview() {
  const S = useErp();
  const on = S.animals.filter((a) => a.status === "active");
  const month = S.today.slice(0, 7);
  const thisMonth = (d?: string) => !!d && d.slice(0, 7) === month;
  const born = S.animals.filter((a) => a.source === "born" && thisMonth(a.joined)).length;
  const died = S.animals.filter((a) => (a.status === "died" || a.status === "culled") && thisMonth(a.leftOn)).length;
  const sold = S.animals.filter((a) => a.status === "sold" && thisMonth(a.leftOn)).length;
  const feed = feedByType(
    S.products,
    [...S.broilerFeedDeliveries.filter((d) => d.unit === "ruminants"), ...millFeed(S.feedSales, S.products, "ruminants")],
    S.ruminantFeed
  ).reduce((a, r) => a + r.stock, 0);
  const rows = SPECIES.map((s) => {
    const mine = on.filter((a) => a.species === s.key);
    return { ...s, female: mine.filter((a) => a.sex === "female").length, male: mine.filter((a) => a.sex === "male").length, total: mine.length };
  }).filter((r) => r.total || S.animals.some((a) => a.species === r.key));
  const paged = usePaged(rows);

  return (
    <>
      <PageHeader
        eyebrow="Ruminants"
        title="Overview"
        sub="Goats, sheep and cattle, each by its tag"
        action={
          <Link href="/ruminants/animals" className="font-sub rounded-[10px] bg-[#055a5b] px-5 py-2.5 text-[14px] text-white hover:bg-[#044647]">
            Animals
          </Link>
        }
      />
      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="On the farm" value={fmtK(on.length)} sub={`${fmtK(on.filter((a) => a.sex === "female").length)} female`} color="#055a5b" />
        <Kpi label="Born this month" value={fmtK(born)} color="#016559" />
        <Kpi label="Sold this month" value={fmtK(sold)} sub={`${fmtK(died)} died or culled`} color={died ? "#c7402f" : undefined} />
        <Kpi label="Feed stock" value={fmtBags(Math.max(0, feed), S.feedBagKg)} sub="all types" />
      </div>
      <Card className="overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Herd by species</CardTitle>
        </div>
        <div className="mt-2">
          <Table pager={paged.pager}>
            <THead>
              <Th>Species</Th>
              <Th right>Female</Th>
              <Th right>Male</Th>
              <Th right>Total</Th>
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <TRow>
                  <Td colSpan={4} className="text-[#84908f]">
                    No animals yet — add them on Animals.
                  </Td>
                </TRow>
              ) : null}
              {paged.rows.map((r) => (
                <TRow key={r.key}>
                  <Td className="font-semibold">{r.label}</Td>
                  <Td right>{fmtK(r.female)}</Td>
                  <Td right>{fmtK(r.male)}</Td>
                  <Td right className="font-semibold">
                    {fmtK(r.total)}
                  </Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>Counts are animals on the farm now. Births, deaths, culls and sales are recorded on Animals and Sales.</Note>
    </>
  );
}
