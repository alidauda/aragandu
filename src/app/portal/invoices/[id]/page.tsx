import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { loadInvoice } from "@/lib/invoice-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Invoice — Argandu Farms" };

/** A buyer's own invoice. Anyone else's is a 404, not a hint it exists. */
export default async function BuyerInvoicePage(props: PageProps<"/portal/invoices/[id]">) {
  const session = await getSession();
  const customerId = session?.user.customerId;
  if (!session || session.user.role !== "customer" || !customerId || session.user.disabled) {
    redirect("/portal");
  }
  const { id } = await props.params;
  const invoice = Number.isInteger(Number(id)) ? await loadInvoice(Number(id)) : null;
  if (!invoice || invoice.customerId !== customerId) notFound();
  return (
    <InvoiceDocument
      invoice={invoice}
      actions={
        <>
          <a href="/portal" className="rounded-[10px] border border-[#dce1da] bg-white px-4 py-2 text-sm font-semibold text-[#4c5a51]">
            ← Back
          </a>
          <PrintButton />
        </>
      }
    />
  );
}
