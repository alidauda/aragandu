import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { actionLabel } from "@/lib/audit-labels";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ActivityTable } from "./ActivityTable";

export const metadata: Metadata = { title: "Activity — AFEMS" };

/** Admin: the audit log, newest first. */
export default async function ActivityPage(props: PageProps<"/activity">) {
  const session = await getSession();
  if (session?.user.role !== "admin") notFound();
  const { who } = await props.searchParams;
  const actor = typeof who === "string" && who ? who : undefined;

  const [entries, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where: actor ? { actor } : undefined,
      orderBy: { at: "desc" },
      take: 300,
    }),
    prisma.auditLog.findMany({ distinct: ["actor"], select: { actor: true }, orderBy: { actor: "asc" } }),
  ]);

  return (
    <ActivityTable
      actor={actor ?? ""}
      actors={actors.map((a) => a.actor)}
      entries={entries.map((e) => ({
        id: e.id,
        at: e.at.toISOString(),
        actor: e.actor,
        action: actionLabel(e.action),
        summary: e.summary,
        details: e.details === null ? "" : JSON.stringify(e.details, null, 2),
      }))}
    />
  );
}
