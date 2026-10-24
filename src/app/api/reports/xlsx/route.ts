import { loadFarmReport } from "@/lib/reports/load";
import { reportWorkbook } from "@/lib/reports/xlsx";

/** The comprehensive report as an Excel download, for the period in the URL. */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const loaded = await loadFarmReport(params);
  if (!loaded) return new Response("Not found", { status: 404 });
  const { report, period } = loaded;
  const buffer = await reportWorkbook(report);
  const name = `argandu-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${period.from === "2000-01-01" ? "to" : period.from}-${period.to}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
