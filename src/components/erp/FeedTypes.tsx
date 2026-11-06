"use client";

import { feedByType, fmtBags } from "@/lib/erp/derive";
import type { Product } from "@/lib/erp/types";
import { Card, CardTitle, Table, Td, Th, THead, TRow, usePaged } from "@/components/erp/ui";

/** A feed type's name (a mill product); "—" for entries from before types were kept. */
export const feedTypeName = (products: Product[], id?: number) =>
  id === undefined ? "—" : (products.find((p) => p.id === id)?.name ?? "—");

/** Feed on hand by type, in bags. */
export function FeedStockCard({ rows, bagKg }: { rows: ReturnType<typeof feedByType>; bagKg: number }) {
  const paged = usePaged(rows);
  if (rows.length === 0) return null;
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="px-4 pt-3.5">
        <CardTitle>Stock by feed type</CardTitle>
      </div>
      <div className="mt-2">
        <Table pager={paged.pager}>
          <THead>
            <Th>Feed type</Th>
            <Th right>Came in</Th>
            <Th right>Used</Th>
            <Th right>On hand</Th>
          </THead>
          <tbody>
            {paged.rows.map((r) => (
              <TRow key={r.id ?? "none"}>
                <Td className="font-semibold">{r.name}</Td>
                <Td right>{fmtBags(r.in, bagKg)}</Td>
                <Td right>{fmtBags(r.used, bagKg)}</Td>
                <Td right className="font-semibold">
                  <span style={{ color: r.stock < 0 ? "#c7402f" : undefined }}>{fmtBags(r.stock, bagKg)}</span>
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
