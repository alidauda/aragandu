import { Kpi, Note, PageHeader } from "@/components/erp/ui";
import {
  CreditTable,
  HowToPay,
  InvoicesTable,
  PaymentNotice,
  PaymentsTable,
  Section,
} from "@/components/portal/parts";
import { blockingDebt, debtAmount, naira } from "@/lib/orders";
import { getBuyer } from "@/lib/portal-data";

/** Invoices, what's been paid, and the buyer's credit account. */
export default async function PortalPayments(props: PageProps<"/portal/payments">) {
  const buyer = await getBuyer();
  if (buyer.state !== "buyer") return null;
  const d = buyer.data;
  const { payment } = await props.searchParams;

  const unpaid = d.invoices.filter((v) => v.status === "pending");
  const owed = debtAmount(unpaid);
  const overdue = debtAmount(blockingDebt(d.invoices, d.weekStart));
  const month = d.today.slice(0, 7);
  const paidThisMonth = d.payments
    .filter((p) => p.date.startsWith(month) && p.method !== "credit")
    .reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Buyer portal"
        title="Payments"
        sub={d.payOnline ? "Your invoices — pay online with card, transfer or USSD" : "Your invoices and payments"}
      />
      <PaymentNotice result={typeof payment === "string" ? payment : undefined} />
      {!d.payOnline ? <HowToPay payTo={d.payTo} /> : null}

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="Outstanding"
          value={naira.format(owed)}
          sub={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`}
          color={owed > 0 ? "#9a6a12" : "#016559"}
        />
        <Kpi
          label="Overdue"
          value={naira.format(overdue)}
          sub={overdue > 0 ? "From previous weeks — pauses ordering" : "Nothing overdue"}
          color={overdue > 0 ? "#c7402f" : "#0d1d1d"}
        />
        <Kpi label="Paid this month" value={naira.format(paidThisMonth)} sub="Money received by the farm" color="#016559" />
        <Kpi
          label="Credit"
          value={naira.format(Math.max(0, d.credit))}
          sub="Used on your next invoice"
          color={d.credit > 0 ? "#016559" : "#0d1d1d"}
        />
      </div>

      <div className="mt-4">
        <Section title="Invoices">
          <InvoicesTable invoices={d.invoices} payOnline={d.payOnline} weekStart={d.weekStart} proofs={d.proofs} />
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Payment history">
          <PaymentsTable payments={d.payments} />
        </Section>
      </div>

      {d.credits.length ? (
        <div className="mt-4">
          <Section title="Credit account">
            <CreditTable credits={d.credits} />
          </Section>
        </div>
      ) : null}

      <Note>
        {d.payOnline
          ? "Pay now opens Paystack's secure checkout; your invoice updates as soon as the payment is confirmed. "
          : "Pay the farm directly — they record it once received. "}
        Anything paid over an invoice is kept as credit and used on your next one. An invoice still unpaid
        when a new week starts is overdue and pauses ordering until it&apos;s paid.
      </Note>
    </>
  );
}
