import { Kpi, Note, PageHeader } from "@/components/erp/ui";
import { DebtBanner, NewOrderButton, OrdersTable, PaymentNotice, Section } from "@/components/portal/parts";
import { allocationLeft, blockingDebt, cratesOrderedInWeek, debtAmount } from "@/lib/orders";
import { getBuyer } from "@/lib/portal-data";

/** Every order the buyer has placed, and the button to place (and pay for) another. */
export default async function PortalOrders(props: PageProps<"/portal/orders">) {
  const buyer = await getBuyer();
  if (buyer.state !== "buyer") return null;
  const d = buyer.data;
  const { payment } = await props.searchParams;

  const ordered = cratesOrderedInWeek(d.orders, d.weekStart);
  const left = allocationLeft(d.weeklyCrates, ordered);
  const blocking = blockingDebt(d.invoices, d.weekStart);
  const unpaid = d.orders.filter((o) => o.status === "pending" && !o.paidAt);
  const withFarm = d.orders.filter((o) => o.status === "pending" && o.paidAt);
  const toConfirm = d.orders.filter((o) => o.status === "fulfilled" && !o.deliveredAt);
  const month = d.today.slice(0, 7);
  // Delivered = invoiced: counted by the invoice date, not when it was ordered.
  const thisMonth = d.invoices
    .filter((v) => v.unit === "crates" && v.date.startsWith(month))
    .reduce((a, v) => a + v.qty, 0);

  return (
    <>
      <PageHeader
        eyebrow="Buyer portal"
        title="Orders"
        sub="Order within your weekly allocation and track every order"
        action={
          <NewOrderButton
            left={left}
            used={ordered}
            weeklyCrates={d.weeklyCrates}
            cratePrice={d.cratePrice}
            eggsPerCrate={d.eggsPerCrate}
            blocked={blocking.length > 0}
            weekStart={d.weekStart}
            freeCredit={d.credit - d.heldCredit}
            payOnline={d.payOnline}
          />
        }
      />
      <PaymentNotice result={typeof payment === "string" ? payment : undefined} />
      <DebtBanner owed={debtAmount(blocking)} count={blocking.length} payOnline={d.payOnline} />

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Ordered this week" value={`${ordered} crates`} sub={`${left} of ${d.weeklyCrates} left`} />
        <Kpi
          label="Awaiting your payment"
          value={String(unpaid.length)}
          sub={unpaid.length ? "Pay now — unpaid orders are released after 24 hours" : "Nothing to pay"}
          color={unpaid.length ? "#9a6a12" : "#14231a"}
        />
        <Kpi
          label="Paid · with the farm"
          value={String(withFarm.length)}
          sub={`${withFarm.reduce((a, o) => a + o.crates, 0)} crates being prepared`}
          color="#3a8bd6"
        />
        <Kpi
          label="To confirm received"
          value={String(toConfirm.length)}
          sub="Fulfilled — press Mark received when they arrive"
          color="#3a8bd6"
        />

      </div>

      <div className="mt-4">
        <Section title="All orders">
          <OrdersTable orders={d.orders} payOnline={d.payOnline} />
        </Section>
      </div>
      <Note>
        You pay when you order — your order goes to the farm once it&apos;s paid. Unpaid orders hold
        their crates for 24 hours. If the farm can&apos;t supply all of a paid order, what isn&apos;t
        sent stays as your credit for the next one. Your allocation resets every Monday; the price is
        locked in when you order. {thisMonth ? `${thisMonth} crates delivered to you this month.` : ""}
      </Note>
    </>
  );
}
