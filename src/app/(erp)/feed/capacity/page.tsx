"use client";

import { useErp } from "@/lib/erp/store";
import { capacityPositions, fmtK } from "@/lib/erp/derive";
import {
  Card,
  CardTitle,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";

export default function FeedCapacity() {
  const S = useErp();
  const caps = capacityPositions(S.products, S.runs, S.ingredients, S.deliveries);

  return (
    <>
      <PageHeader
        eyebrow="Feed Mill"
        title="Capacity"
        sub="What today's stock allows, and what runs out first"
      />

      <div className="stagger grid grid-cols-2 gap-3.5">
        {caps.map((c) => (
          <Card key={c.product.id} className="overflow-hidden">
            <div className="px-4 pt-3.5">
              <CardTitle>{c.product.name}</CardTitle>
              <div className="mt-0.5 text-xs text-[#8a9070]">
                Recipe learned from {c.sourceRun}
              </div>
              <div className="mt-2.5 font-display text-2xl font-bold tabular-nums text-[#3c4d28]">
                {fmtK(c.maxMixKg)} kg{" "}
                <span className="text-[13px] font-semibold text-[#79815f]">
                  ≈ {fmtK(c.bags)} bags mixable now
                </span>
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#b3402f]">
                Bottleneck: {c.bottleneck}
              </div>
            </div>
            <div className="mt-3">
              <Table>
                <THead>
                  <Th>Ingredient</Th>
                  <Th right>Share</Th>
                  <Th right>On hand kg</Th>
                  <Th right>Allows kg</Th>
                </THead>
                <tbody>
                  {c.lines.map((l) => (
                    <TRow key={l.ing.id}>
                      <Td
                        className={
                          l.ing.name === c.bottleneck ? "font-bold text-[#b3402f]" : ""
                        }
                      >
                        {l.ing.name}
                      </Td>
                      <Td right>{l.sharePct.toFixed(1)}%</Td>
                      <Td right>{fmtK(l.onHand)}</Td>
                      <Td right>{fmtK(l.allows)}</Td>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        ))}
      </div>
      <Note>
        The recipe is reverse-engineered from each product&apos;s latest real
        run — no recipe entity to maintain. The tightest ingredient caps the
        batch.
      </Note>
    </>
  );
}
