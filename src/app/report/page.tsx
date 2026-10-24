import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PeriodPicker } from "@/components/erp/PeriodPicker";
import { ReportDocument } from "@/components/report/ReportDocument";
import { ReportToolbar } from "@/components/report/ReportToolbar";
import { loadFarmReport } from "@/lib/reports/load";

export const metadata: Metadata = { title: "Farm report — Argandu Farms" };

/**
 * The comprehensive report for a period, ready to print or save as PDF,
 * with the same figures as the Excel download. ?period= or ?from=&to=.
 */
export default async function ReportPage(props: PageProps<"/report">) {
  const params = await props.searchParams;
  const loaded = await loadFarmReport(params);
  if (!loaded) notFound();
  const { report, period, today } = loaded;
  const query: Record<string, string> =
    period.preset === "custom" ? { from: period.from, to: period.to } : { period: period.preset };
  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 py-6 print:bg-white print:p-0">
      <ReportToolbar excelHref={`/api/reports/xlsx?${new URLSearchParams(query)}`}>
        <PeriodPicker path="/report" period={period} today={today} />
      </ReportToolbar>
      <ReportDocument report={report} />
    </main>
  );
}
