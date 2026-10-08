import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmailInvoiceButton } from "@/components/EmailInvoiceButton";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { emailEnabled } from "@/lib/email";
import { loadInvoice } from "@/lib/invoice-data";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Invoice — Argandu Farms" };

/** Staff view of any invoice, ready to print. */
export default async function StaffInvoicePage(props: PageProps<"/invoices/[id]">) {
  const session = await getSession();
  if (!session || !isTeam(session.user.role) || session.user.disabled) redirect("/login");
  const { id } = await props.params;
  const invoice = Number.isInteger(Number(id)) ? await loadInvoice(Number(id)) : null;
  if (!invoice) notFound();
  return (
    <InvoiceDocument
      invoice={invoice}
      actions={
        <>
          {emailEnabled() && invoice.customerId ? <EmailInvoiceButton invoiceId={invoice.id} /> : null}
          <PrintButton />
        </>
      }
    />
  );
}
