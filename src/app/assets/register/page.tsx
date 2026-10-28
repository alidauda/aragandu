import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canSee, locationsOf } from "@/lib/access";
import { byTag, CONDITION_LABEL, type AssetCondition } from "@/lib/erp/assets";
import { longDate, farmToday } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { grantsOf } from "@/lib/grants";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = { title: "Asset register — Argandu Farms" };

/**
 * The asset register on paper: S/N, item, item number, location and
 * condition, as the farm keeps it — for a stock-take or the file. Filters
 * from the register page: ?location=&condition=&item=.
 */
export default async function AssetRegisterPrint(props: PageProps<"/assets/register">) {
  const session = await getSession();
  if (!session || !isTeam(session.user.role) || session.user.disabled) notFound();
  const grants = await grantsOf(session.user.id);
  if (!canSee(grants, "inventory") || locationsOf(grants) !== null) notFound();

  const q = await props.searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const location = one(q.location);
  const condition = one(q.condition);
  const item = one(q.item);
  const assets = (
    await prisma.asset.findMany({
      where: { disposedAt: null, ...(location ? { location } : {}), ...(condition ? { condition } : {}), ...(item ? { name: item } : {}) },
    })
  ).sort(byTag);
  const filters = [item, location, condition && CONDITION_LABEL[condition as AssetCondition]].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-[#f4f6f5] px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[820px] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/inventory/assets" className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]">
          ← Asset register
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[820px] rounded-2xl border border-[#e4eaea] bg-white px-6 py-7 sm:px-10 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <Logo caption="Farms" />
          <div className="text-right text-[12.5px] text-[#465657]">
            <div className="font-display text-[20px] font-bold text-[#0d1d1d]">Asset register</div>
            <div>{longDate(farmToday())}</div>
            {filters ? <div>{filters}</div> : null}
            <div>
              {assets.length} item{assets.length === 1 ? "" : "s"}
            </div>
          </div>
        </header>

        <div className="mt-6 overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="table-header-group">
              <tr className="bg-[#f4f6f5] text-left">
                {["S/N", "Item", "Item number", "Location", "Condition"].map((h) => (
                  <th key={h} className="border border-[#ccd7d6] px-2.5 py-1.5 font-semibold uppercase tracking-wide text-[#465657]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={a.id} className="break-inside-avoid">
                  <td className="border border-[#ccd7d6] px-2.5 py-1">{i + 1}</td>
                  <td className="border border-[#ccd7d6] px-2.5 py-1">{a.name}</td>
                  <td className="border border-[#ccd7d6] px-2.5 py-1 font-figure whitespace-nowrap">{a.tag}</td>
                  <td className="border border-[#ccd7d6] px-2.5 py-1">{a.location}</td>
                  <td className="border border-[#ccd7d6] px-2.5 py-1 uppercase">
                    {CONDITION_LABEL[a.condition as AssetCondition] ?? a.condition}
                  </td>
                </tr>
              ))}
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-[#ccd7d6] px-2.5 py-3 text-[#84908f]">
                    Nothing on the register{filters ? " for these filters" : ""}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className="mt-10 grid grid-cols-2 gap-8 text-[12.5px] text-[#465657] break-inside-avoid">
          {["Checked by", "Approved by"].map((who) => (
            <div key={who}>
              <div className="h-8 border-b border-[#0d1d1d]" />
              <div className="mt-1">{who} · name, signature and date</div>
            </div>
          ))}
        </footer>
      </article>
    </main>
  );
}
