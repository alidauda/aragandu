import "server-only";

import ExcelJS from "exceljs";

import type { Column, FarmReport } from "@/lib/reports/types";

/**
 * The report as an Excel workbook: a Summary sheet with every headline
 * figure, then one sheet per table with real numbers (₦, counts, percents,
 * dates) so it can be sorted, filtered and summed.
 */

const GREEN = "FF2F8F46";
const INK = "FF14231A";
const MUTED = "FF647067";
const HEAD = "FFEAF5EC";

const FORMAT: Record<NonNullable<Column["kind"]>, string> = {
  text: "@",
  date: "dd mmm yyyy",
  number: "#,##0",
  money: '"₦"#,##0',
  percent: "0.0%",
};

/** Excel sheet names: ≤31 characters, none of []:*?/\ , unique. */
function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

const asDate = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : v;

export async function reportWorkbook(report: FarmReport) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Argandu Farms";
  wb.created = new Date();
  const used = new Set<string>();

  // ── Summary ──
  const sum = wb.addWorksheet(sheetName("Summary", used), { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 34 }, { width: 22 }, { width: 46 }];
  sum.addRow([`Argandu Farms — ${report.title}`]).font = { bold: true, size: 16, color: { argb: INK } };
  sum.addRow([report.periodLabel]).font = { size: 12, color: { argb: MUTED } };
  sum.addRow([`${report.scope} · generated ${report.generatedAt} by ${report.generatedBy}`]).font = { size: 10, color: { argb: MUTED } };
  for (const s of report.sections) {
    if (s.stats.length === 0) continue;
    sum.addRow([]);
    const h = sum.addRow([s.title]);
    h.font = { bold: true, size: 13, color: { argb: GREEN } };
    for (const st of s.stats) {
      const r = sum.addRow([st.label, st.value, st.sub ?? ""]);
      r.getCell(2).font = { bold: true };
      r.getCell(3).font = { color: { argb: MUTED } };
    }
  }
  sum.addRow([]);
  const contents = sum.addRow(["Sheets in this workbook"]);
  contents.font = { bold: true, size: 13, color: { argb: GREEN } };

  // ── One sheet per table ──
  for (const s of report.sections) {
    for (const t of s.tables) {
      const name = sheetName(t.title, used);
      sum.addRow([name, s.title, t.note ?? ""]).getCell(3).font = { color: { argb: MUTED } };
      const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = t.columns.map((c) => {
        const longest = Math.max(
          c.label.length,
          ...t.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length)
        );
        return {
          header: c.label,
          key: c.key,
          width: Math.min(48, Math.max(10, longest + 3)),
          style: { numFmt: FORMAT[c.kind ?? "text"] },
        };
      });
      const header = ws.getRow(1);
      header.font = { bold: true, color: { argb: INK } };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
      header.alignment = { vertical: "middle" };

      for (const r of t.rows) {
        ws.addRow(Object.fromEntries(t.columns.map((c) => [c.key, c.kind === "date" ? asDate(r[c.key]) : (r[c.key] ?? null)])));
      }
      if (t.rows.length) {
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columns.length } };
      }
      if (t.totals) {
        const tr = ws.addRow(Object.fromEntries(t.columns.map((c) => [c.key, t.totals![c.key] ?? null])));
        tr.font = { bold: true };
        tr.eachCell((cell) => {
          cell.border = { top: { style: "thin", color: { argb: INK } } };
        });
      }
      if (t.rows.length === 0) ws.addRow({ [t.columns[0].key]: "Nothing in this period." });
    }
  }
  return wb.xlsx.writeBuffer();
}
