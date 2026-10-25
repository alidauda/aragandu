import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { emailEnabled } from "@/lib/email";
import { farmToday, toDbDate } from "@/lib/dates";
import { canSee } from "@/lib/access";
import { grantsOf } from "@/lib/grants";
import { getSession } from "@/lib/session";
import { EmailLogTable } from "./EmailLogTable";

export const metadata: Metadata = { title: "Email log — AFEMS" };

/** Admin: every email the app tried to send, newest first. */
export default async function EmailLogPage(props: PageProps<"/emails">) {
  const session = await getSession();
  // The owner and farm-wide admins only.
  if (!session || !canSee(await grantsOf(session.user.id), "emails")) notFound();
  const { status, q } = await props.searchParams;
  const only = status === "sent" || status === "failed" ? status : "";
  const term = typeof q === "string" ? q.trim() : "";

  const today = toDbDate(farmToday());
  const week = new Date(today.getTime() - 6 * 86_400_000);
  const month = toDbDate(`${farmToday().slice(0, 7)}-01`);

  const [entries, sentToday, failedWeek, monthCount] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        ...(only ? { status: only } : {}),
        ...(term
          ? { OR: [{ subject: { contains: term, mode: "insensitive" } }, { to: { has: term.toLowerCase() } }] }
          : {}),
      },
      orderBy: { at: "desc" },
      take: 300,
    }),
    prisma.emailLog.count({ where: { status: "sent", at: { gte: today } } }),
    prisma.emailLog.count({ where: { status: "failed", at: { gte: week } } }),
    prisma.emailLog.count({ where: { at: { gte: month } } }),
  ]);

  return (
    <EmailLogTable
      enabled={emailEnabled()}
      status={only}
      q={term}
      stats={{ sentToday, failedWeek, monthCount }}
      entries={entries.map((e) => ({
        id: e.id,
        at: e.at.toISOString(),
        kind: e.kind,
        to: e.to,
        subject: e.subject,
        status: e.status,
        error: e.error ?? "",
        providerId: e.providerId ?? "",
      }))}
    />
  );
}
