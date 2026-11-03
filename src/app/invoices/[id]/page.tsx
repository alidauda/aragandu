import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmailInvoiceButton } from "@/components/EmailInvoiceButton";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { emailEnabled } from "@/lib/email";
import { loadInvoice } from "@/lib/invoice-data";
import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { isTeam } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { BROILER_PRODUCT } from "@/lib/erp/broilers";

export const metadata: Metadata = { title: "Invoice — Argandu Farms" };

/** Staff view of any invoice, ready to print. */
export default async function StaffInvoicePage(props: PageProps<"/invoices/[id]">) {
  const session = await getSession();
  if (!session || !isTeam(session.user.role) || session.user.disabled) redirect("/login");
  // Invoices are for egg sales and money roles, and Broilers for theirs.
  const grants = await grantsOf(session.user.id);
  const { id } = await props.params;
  const invoice = Number.isInteger(Number(id)) ? await loadInvoice(Number(id)) : null;
  if (!invoice) notFound();
  // Broiler staff open their own sales' invoices.
  const broilers = canSee(grants, "broilers") && invoice.product === BROILER_PRODUCT;
  if (!canSee(grants, "eggsales") && !canSee(grants, "money") && !broilers) notFound();
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
