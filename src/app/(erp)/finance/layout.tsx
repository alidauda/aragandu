import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Finance — AFEMS" };

/** Profit and loss: finance roles only. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canSee(await grantsOf(session.user.id), "finance")) notFound();
  return children;
}
