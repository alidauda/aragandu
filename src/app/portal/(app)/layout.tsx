import type { Metadata } from "next";
import { Suspense } from "react";

import { NotABuyer, PortalLogin } from "@/components/Portal";
import { PortalShell } from "@/components/portal/Shell";
import { getBuyer } from "@/lib/portal-data";

export const metadata: Metadata = {
  title: "Argandu Farms — Buyer Portal",
  description: "Order eggs from Argandu Farms within your weekly allocation.",
};

/** The buyer's dashboard shell. Signed out, any portal page is the sign-in. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const buyer = await getBuyer();
  if (buyer.state === "signed-out") {
    return (
      <Suspense>
        <PortalLogin />
      </Suspense>
    );
  }
  if (buyer.state === "not-buyer") return <NotABuyer />;
  const d = buyer.data;
  return (
    <PortalShell
      name={d.name}
      email={d.email}
      today={d.today}
      pendingOrders={d.orders.filter((o) => o.status === "pending" && o.date >= d.weekStart).length}
      unpaidInvoices={d.invoices.filter((v) => v.status === "pending").length}
    >
      {children}
    </PortalShell>
  );
}
