/**
 * A report as data: sections of headline figures and tables. One builder
 * fills it; the printable page and the Excel workbook both read it, so the
 * two can never disagree.
 */

export type Cell = string | number | null;

export type ColumnKind = "text" | "date" | "number" | "money" | "percent";

export type Column = {
  key: string;
  label: string;
  kind?: ColumnKind;
  /** Only in the Excel workbook — too much detail for the printed report. */
  sheetOnly?: boolean;
};

export type ReportTable = {
  /** Also the Excel sheet name (shortened to 31 characters). */
  title: string;
  note?: string;
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
};

export type Stat = { label: string; value: string; sub?: string };

export type ReportSection = {
  key: string;
  title: string;
  note?: string;
  stats: Stat[];
  tables: ReportTable[];
};

export type FarmReport = {
  title: string;
  /** Whole farm, or the division it was made for. */
  scope: string;
  from: string;
  to: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
  sections: ReportSection[];
};
