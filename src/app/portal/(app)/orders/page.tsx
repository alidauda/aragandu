import { Kpi, Note, PageHeader } from "@/components/erp/ui";
import { DebtBanner, OrderForm, OrdersTable, Section } from "@/components/portal/parts";
import { allocationLeft, blockingDebt, cratesOrderedInWeek, debtAmount } from "@/lib/orders";
import { getBuyer } from "@/lib/portal-data";

/** Every order the buyer has placed, and the form to place another. */
export default async function PortalOrders() {
  const buyer = await getBuyer();
  if (buyer.state !== "buyer") return null;
  const d = buyer.data;

  const ordered = cratesOrderedInWeek(d.orders, d.weekStart);
  const left = allocationLeft(d.weeklyCrates, ordered);
  const blocking = blockingDebt(d.invoices, d.weekStart);
  const pending = d.orders.filter((o) => o.status === "pending" && o.date >= d.weekStart);
  const toConfirm = d.orders.filter((o) => o.status === "fulfilled" && !o.deliveredAt);
  const month = d.today.slice(0, 7);
  const thisMonth = d.orders
    .filter((o) => o.status === "fulfilled" && o.date.startsWith(month))
    .reduce((a, o) => a + o.crates, 0);

  return (
    <>
      <PageHeader eyebrow="Buyer portal" title="Orders" sub="Order within your weekly allocation and track every order" />
      <DebtBanner owed={debtAmount(blocking)} count={blocking.length} payOnline={d.payOnline} />

      <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Ordered this week" value={`${ordered} crates`} sub={`${left} of ${d.weeklyCrates} left`} />
        <Kpi
          label="Waiting for the farm"
          value={String(pending.length)}
          sub={`${pending.reduce((a, o) => a + o.crates, 0)} crates pending`}
          color="#9a6a12"
        />
        <Kpi
          label="To confirm received"
          value={String(toConfirm.length)}
          sub="Fulfilled — press Mark received when they arrive"
          color="#3a8bd6"
        />
        <Kpi label="Delivered this month" value={`${thisMonth} crates`} sub="Fulfilled orders" color="#23753a" />
      </div>

      <div className="mt-4">
        <OrderForm left={left} weeklyCrates={d.weeklyCrates} cratePrice={d.cratePrice} blocked={blocking.length > 0} />
      </div>

      <div className="mt-4">
        <Section title="All orders">
          <OrdersTable orders={d.orders} weekStart={d.weekStart} />
        </Section>
      </div>
      <Note>
        Your allocation resets every Monday. The price is locked in when you order. An order the farm
        hasn&apos;t filled by Sunday expires — order again from the new week&apos;s allocation.
      </Note>
    </>
  );
}
