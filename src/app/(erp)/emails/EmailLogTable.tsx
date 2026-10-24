"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Card, Kpi, Note, PageHeader, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

type Entry = {
  id: number;
  at: string;
  kind: string;
  to: string[];
  subject: string;
  status: string;
  error: string;
  providerId: string;
};

/** Plain names for the email types the app sends. */
const KIND: Record<string, string> = {
  invite: "Invite",
  "password-reset": "Password reset",
  "password-changed": "Password changed",
  "order-received": "Order received",
  "order-fulfilled": "Order fulfilled",
  "order-declined": "Order not fulfilled",
  invoice: "Invoice",
  "payment-receipt": "Payment receipt",
  "credit-receipt": "Credit receipt",
  "admin-new-order": "Admin · new order",
  "admin-alert": "Admin · alert",
  other: "Other",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function EmailLogTable({
  entries,
  status,
  q,
  stats,
  enabled,
}: {
  entries: Entry[];
  status: string;
  q: string;
  stats: { sentToday: number; failedWeek: number; monthCount: number };
  enabled: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const go = (next: { status?: string; q?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? status;
    const t = next.q ?? search;
    if (s) p.set("status", s);
    if (t.trim()) p.set("q", t.trim());
    router.push(`/emails${p.size ? `?${p}` : ""}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Email log"
        sub="Every email the app sent — invites, resets, orders, receipts and alerts"
        action={
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go({});
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email or subject"
                className="w-[220px] rounded-lg border border-[#dce1da] bg-white px-3 py-1.5 text-[13px]"
              />
            </form>
            <select
              value={status}
              onChange={(e) => go({ status: e.target.value })}
              className="rounded-lg border border-[#dce1da] bg-white px-3 py-1.5 text-[13px]"
            >
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </>
        }
      />

      {!enabled ? (
        <div className="mb-4 rounded-2xl border border-[#f0e2bf] bg-[#fcf6e8] px-4 py-3 text-[14px] text-[#7a5410]">
          Email is switched off — nothing is being sent. Set the email key and EMAIL_FROM on the server to turn it on.
        </div>
      ) : null}

      <div className="stagger mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Kpi label="Sent today" value={String(stats.sentToday)} color="#23753a" />
        <Kpi
          label="Failed — last 7 days"
          value={String(stats.failedWeek)}
          sub={stats.failedWeek ? "Open them below to see why" : "Everything went through"}
          color={stats.failedWeek ? "#c7402f" : "#14231a"}
        />
        <Kpi label="This month" value={String(stats.monthCount)} sub="Emails attempted" />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>When</Th>
            <Th>Type</Th>
            <Th>To</Th>
            <Th>Subject</Th>
            <Th>Status</Th>
          </THead>
          <tbody>
            {entries.length === 0 ? (
              <TRow>
                <Td colSpan={5} className="text-[#8b958d]">
                  {q || status ? "No emails match." : "No emails sent yet."}
                </Td>
              </TRow>
            ) : null}
            {entries.map((e) => (
              <TRow key={e.id}>
                <Td className="whitespace-nowrap text-[#4c5a51]">{when(e.at)}</Td>
                <Td className="text-[#4c5a51]">{KIND[e.kind] ?? e.kind}</Td>
                <Td className="!whitespace-normal text-[13px]">{e.to.join(", ")}</Td>
                <Td className="!whitespace-normal max-w-[360px] text-[13px]">{e.subject}</Td>
                <Td className="!whitespace-normal">
                  {e.status === "sent" ? (
                    <span title={e.providerId ? `Provider id: ${e.providerId}` : undefined}>
                      <Badge label="sent" bg="#e7f4ea" fg="#23753a" />
                    </span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer list-none">
                        <Badge label="failed" bg="#fbeae7" fg="#c7402f" />
                      </summary>
                      <div className="mt-1.5 max-w-[320px] text-[12px] text-[#8a2f22]">{e.error || "No reason given."}</div>
                    </details>
                  )}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>
        The latest 300. &quot;Sent&quot; means the email service accepted it; bounces show in the provider&apos;s own
        dashboard. Email bodies aren&apos;t stored — reset links are private.
      </Note>
    </>
  );
}
