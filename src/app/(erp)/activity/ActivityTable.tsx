"use client";

import { useRouter } from "next/navigation";

import { Card, Note, PageHeader, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

type Entry = { id: number; at: string; actor: string; action: string; summary: string; details: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ActivityTable({
  entries,
  actors,
  actor,
}: {
  entries: Entry[];
  actors: string[];
  actor: string;
}) {
  const router = useRouter();
  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Activity"
        sub="Who did what, and when — every change in the ERP and portal"
        action={
          <select
            value={actor}
            onChange={(e) =>
              router.push(e.target.value ? `/activity?who=${encodeURIComponent(e.target.value)}` : "/activity")
            }
            className="rounded-lg border border-[#cfd3bd] bg-white px-3 py-1.5 text-[13px]"
          >
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>What</Th>
            <Th>Details</Th>
          </THead>
          <tbody>
            {entries.length === 0 ? (
              <TRow>
                <Td colSpan={4} className="text-[#8a9070]">
                  Nothing recorded yet.
                </Td>
              </TRow>
            ) : null}
            {entries.map((e) => (
              <TRow key={e.id}>
                <Td className="whitespace-nowrap text-[#59614a]">{when(e.at)}</Td>
                <Td className="font-semibold">{e.actor}</Td>
                <Td>{e.action}</Td>
                <Td className="text-[12.5px] text-[#59614a]">
                  {e.details ? (
                    <details>
                      <summary className="cursor-pointer">{e.summary || "details"}</summary>
                      <pre className="mt-1 max-w-[520px] overflow-x-auto whitespace-pre-wrap rounded bg-[#f4f5ec] p-2 text-[11.5px]">
                        {e.details}
                      </pre>
                    </details>
                  ) : (
                    e.summary
                  )}
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <Note>The latest 300 entries. Deletes keep a copy of what was removed.</Note>
    </>
  );
}
