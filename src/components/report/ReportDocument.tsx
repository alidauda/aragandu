import { Logo } from "@/components/Logo";
import { fmtD, fmtK, fmtN } from "@/lib/erp/derive";
import type { Cell, Column, FarmReport, ReportTable } from "@/lib/reports/types";

/**
 * The comprehensive report as a printable document: a cover header, the
 * summary figures, then each section's figures and tables. Print → "Save
 * as PDF" gives a clean A4 document; headers repeat on each page.
 */

function show(v: Cell, kind: Column["kind"]) {
  if (v === null || v === "") return "—";
  if (typeof v === "number") {
    if (kind === "money") return fmtN(v);
    if (kind === "percent") return `${(v * 100).toFixed(1)}%`;
    if (kind === "number") return fmtK(v);
    return String(v);
  }
  if (kind === "date") return fmtD(v);
  return v;
}

const right = (k: Column["kind"]) => k === "number" || k === "money" || k === "percent";

function Table({ t }: { t: ReportTable }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 break-after-avoid">
        <h3 className="text-[14px] font-bold text-[#14231a]">{t.title}</h3>
        {t.note ? <span className="text-[11.5px] text-[#8b958d]">{t.note}</span> : null}
      </div>
      {t.rows.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-[#8b958d]">Nothing in this period.</p>
      ) : (
        <table className="mt-1.5 w-full border-collapse text-[12px]">
          <thead className="table-header-group">
            <tr className="border-b border-[#cfd8cf] bg-[#f4f6f3]">
              {t.columns.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 font-semibold text-[#4c5a51] ${right(c.kind) ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid border-b border-[#eef1ec]">
                {t.columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-1 align-top ${right(c.kind) ? "font-data text-right" : "text-left"} ${
                      c.kind && c.kind !== "text" ? "whitespace-nowrap" : ""
                    } ${c === t.columns[0] ? "whitespace-nowrap" : ""} text-[#14231a]`}
                  >
                    {show(r[c.key] ?? null, c.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {t.totals ? (
            <tfoot>
              <tr className="border-t-2 border-[#14231a] font-bold">
                {t.columns.map((c) => (
                  <td key={c.key} className={`px-2 py-1.5 ${right(c.kind) ? "font-data text-right" : "text-left"}`}>
                    {t.totals![c.key] === undefined ? "" : show(t.totals![c.key] ?? null, c.kind)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      )}
    </div>
  );
}

export function ReportDocument({ report }: { report: FarmReport }) {
  return (
    <article className="mx-auto max-w-[1040px] rounded-2xl border border-[#e7ebe6] bg-white p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#14231a] pb-4">
        <div>
          <Logo caption="Farms" />
          <h1 className="font-display mt-4 text-[28px] font-bold leading-tight text-[#14231a]">{report.title}</h1>
          <p className="mt-1 text-[14px] text-[#4c5a51]">{report.periodLabel}</p>
        </div>
        <div className="text-right text-[12px] text-[#647067]">
          <div>{report.scope}</div>
          <div>Generated {report.generatedAt}</div>
          <div>by {report.generatedBy}</div>
        </div>
      </header>

      {report.sections.map((s) => (
        <section key={s.key} className="mt-7">
          <h2 className="font-display break-after-avoid border-b border-[#e7ebe6] pb-1.5 text-[19px] font-bold text-[#14231a]">{s.title}</h2>
          {s.note ? <p className="mt-1 text-[12px] text-[#8b958d]">{s.note}</p> : null}
          {s.stats.length ? (
            <div className="mt-3 grid break-inside-avoid grid-cols-2 gap-2.5 sm:grid-cols-4 print:grid-cols-4">
              {s.stats.map((st) => (
                <div key={st.label} className="rounded-xl border border-[#e7ebe6] px-3 py-2.5 print:rounded-md">
                  <div className="text-[11.5px] text-[#647067]">{st.label}</div>
                  <div className="font-data font-display mt-0.5 text-[18px] font-bold text-[#14231a]">{st.value}</div>
                  {st.sub ? <div className="mt-0.5 text-[11px] text-[#8b958d]">{st.sub}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          {s.tables.map((t) => (
            <Table key={t.title} t={t} />
          ))}
        </section>
      ))}

      <footer className="mt-8 border-t border-[#e7ebe6] pt-3 text-[11px] text-[#8b958d]">
        Argandu Farms · {report.title} · {report.periodLabel}. Figures come straight from the farm&apos;s records; money
        is in naira.
      </footer>
    </article>
  );
}
