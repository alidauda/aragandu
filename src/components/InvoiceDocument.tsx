import { longDate } from "@/lib/dates";
import { naira } from "@/lib/orders";
import type { InvoiceView } from "@/lib/invoice-data";
import { Logo } from "@/components/Logo";

const METHOD = { transfer: "Bank transfer", cash: "Cash", pos: "POS" } as const;

/** The printable invoice. Print or "Save as PDF" from the browser. */
export function InvoiceDocument({
  invoice: v,
  actions,
}: {
  invoice: InvoiceView;
  /** Buttons above the page (hidden when printing). */
  actions?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-2xl justify-end gap-2 print:hidden">{actions}</div>
      <article className="mx-auto max-w-2xl rounded-xl bg-white p-10 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between">
          <div>
            <Logo caption="Argandu Farms" />
          </div>
          <div className="text-right">
            <div className="text-[13px] font-semibold text-[#647067]">
              Invoice
            </div>
            <div className="font-data text-lg font-bold text-[#14231a]">{v.number}</div>
            <div className="text-sm text-[#647067]">{longDate(v.date)}</div>
          </div>
        </header>

        <section className="mt-8">
          <div className="text-[13px] font-semibold text-[#647067]">
            Bill to
          </div>
          <div className="mt-1 font-semibold text-[#14231a]">{v.billTo}</div>
          {v.phone ? <div className="text-sm text-[#647067]">{v.phone}</div> : null}
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-[#dce1da] text-left text-[12.5px] font-semibold text-[#647067]">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit price</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#eef1ec]">
              <td className="py-3 text-[#14231a]">{v.product}</td>
              <td className="py-3 text-right">
                {v.qty} {v.unit}
              </td>
              <td className="py-3 text-right">{naira.format(v.price)}</td>
              <td className="py-3 text-right font-semibold">{naira.format(v.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[#647067]">Total</span>
            <span className="font-semibold">{naira.format(v.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#647067]">Paid</span>
            <span>{naira.format(v.paid)}</span>
          </div>
          <div className="flex justify-between border-t border-[#dce1da] pt-1 text-base">
            <span className="font-semibold">Balance due</span>
            <span className="font-bold">{naira.format(v.balance)}</span>
          </div>
        </div>

        {v.payments.length ? (
          <section className="mt-8">
            <div className="text-[13px] font-semibold text-[#647067]">
              Payments received
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {v.payments.map((p, i) => (
                  <tr key={i} className="border-b border-[#eef1ec]">
                    <td className="py-2">{longDate(p.date)}</td>
                    <td className="py-2 text-[#647067]">
                      {METHOD[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="py-2 text-right">{naira.format(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-[#e7ebe6] pt-4 text-xs text-[#647067]">
          {v.status === "paid"
            ? "Paid in full — thank you."
            : "Payment by bank transfer; the farm confirms receipt on this invoice."}
        </footer>
      </article>
    </main>
  );
}
