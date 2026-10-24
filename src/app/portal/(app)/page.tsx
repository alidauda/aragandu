import { PageHeader } from "@/components/erp/ui";
import {
  DebtBanner,
  InvoicesTable,
  OrderCard,
  OrdersTable,
  PaymentNotice,
  Section,
  Tile,
} from "@/components/portal/parts";
import { allocationLeft, blockingDebt, cratesOrderedInWeek, debtAmount, naira, shortDate } from "@/lib/orders";
import { getBuyer } from "@/lib/portal-data";

/** The buyer's home: this week at a glance, order, and what's owed. */
export default async function PortalDashboard(props: PageProps<"/portal">) {
  const buyer = await getBuyer();
  if (buyer.state !== "buyer") return null;
  const d = buyer.data;
  const { payment } = await props.searchParams;

  const ordered = cratesOrderedInWeek(d.orders, d.weekStart);
  const left = allocationLeft(d.weeklyCrates, ordered);
  const blocking = blockingDebt(d.invoices, d.weekStart);
  const unpaid = d.invoices.filter((v) => v.status === "pending");
  const owed = debtAmount(unpaid);

  return (
    <>
      <PageHeader
        eyebrow="Buyer portal"
        title={`Welcome, ${d.name}`}
        sub="Your egg orders, invoices and payments with Argandu Farms"
      />
      <PaymentNotice result={typeof payment === "string" ? payment : undefined} />
      <DebtBanner owed={debtAmount(blocking)} count={blocking.length} payOnline={d.payOnline} />

      <div className="stagger grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          forest
          label="Crates left this week"
          value={`${left} / ${d.weeklyCrates}`}
          sub={`Week of ${shortDate(d.weekStart)} · ${ordered} ordered`}
          icon="egg"
        />
        <Tile
          label="Price per crate"
          value={d.cratePrice > 0 ? naira.format(d.cratePrice) : "—"}
          sub="Locked in when you order"
        />
        <Tile
          label="You owe"
          value={owed > 0 ? naira.format(owed) : "Nothing"}
          sub={
            unpaid.length
              ? `${unpaid.length} unpaid invoice${unpaid.length > 1 ? "s" : ""}${
                  blocking.length ? ` · ${blocking.length} overdue` : ""
                }`
              : "All invoices paid"
          }
          color={blocking.length ? "#c7402f" : owed > 0 ? "#9a6a12" : "#016559"}
          icon="receipt"
        />
        <Tile
          label="Credit"
          value={naira.format(Math.max(0, d.credit - d.heldCredit))}
          sub={
            d.heldCredit > 0
              ? `Free to use · ${naira.format(d.heldCredit)} is paying for your orders`
              : d.credit > 0
                ? "Used first on your next order"
                : "Advances and money from unfilled orders"
          }
          color={d.credit - d.heldCredit > 0 ? "#016559" : "#0d1d1d"}
          icon="wallet"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <OrderCard
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
        <Section title="Unpaid invoices" link={{ href: "/portal/payments", label: "All payments →" }}>
          <InvoicesTable
            invoices={unpaid.slice(0, 4)}
            payOnline={d.payOnline}
            weekStart={d.weekStart}
            empty="Nothing to pay — you're all clear."
          />
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Recent orders" link={{ href: "/portal/orders", label: "All orders →" }}>
          <OrdersTable orders={d.orders.slice(0, 5)} payOnline={d.payOnline} />
        </Section>
      </div>
    </>
  );
}
