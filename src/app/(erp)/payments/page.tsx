import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { farmToday } from "@/lib/dates";
import { ledgerTotals, paymentLedger } from "@/lib/payment-ledger";
import { readPeriod } from "@/lib/period";
import { getSession } from "@/lib/session";
import { PaymentsView } from "./PaymentsView";

export const metadata: Metadata = { title: "Payments — AFEMS" };

/** Every payment in and out for a period — the farm's money book (money roles only). */
export default async function PaymentsPage(props: PageProps<"/payments">) {
  const session = await getSession();
  if (!session || !canSee(await grantsOf(session.user.id), "money")) notFound();

  const params = await props.searchParams;
  const today = farmToday();
  const period = readPeriod(params, today);
  const { entries, online } = await paymentLedger(period.from, period.to);
  return (
    <PaymentsView
      today={today}
      period={period}
      entries={entries}
      online={online}
      totals={ledgerTotals(entries)}
    />
  );
}
