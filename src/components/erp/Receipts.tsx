"use client";

import { useErp } from "@/lib/erp/store";
import type { PaymentProof } from "@/lib/erp/types";
import { fmtN } from "@/lib/erp/derive";
import { Badge } from "@/components/erp/ui";
import { UploadReceipt } from "@/components/portal/UploadReceipt";

const TONE = {
  submitted: { label: "to check", bg: "#fcf2de", fg: "#9a6a12" },
  accepted: { label: "accepted", bg: "#e2f0ed", fg: "#016559" },
  rejected: { label: "not accepted", bg: "#fbeae7", fg: "#c7402f" },
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Receipts for an order or invoice that waits on a payment made outside the app. */
export const proofsFor = (proofs: PaymentProof[], target: { orderId: number } | { invoiceId: number }) =>
  proofs.filter((p) => ("orderId" in target ? p.orderId === target.orderId : p.invoiceId === target.invoiceId));

/** The compact line on a table row: "Receipt ₦143,000 · view". */
export function ReceiptChip({ proofs }: { proofs: PaymentProof[] }) {
  const open = proofs.filter((p) => p.status === "submitted");
  // One waiting to be checked, else the one accepted, else the latest.
  const latest = open[0] ?? proofs.find((p) => p.status === "accepted") ?? proofs[0];
  if (!latest) return null;
  return (
    <div className="mt-1 text-[12px]">
      <span className={open.length ? "font-semibold text-[#9a6a12]" : "text-[#84908f]"}>
        {open.length
          ? `Receipt sent · ${fmtN(latest.amount)}`
          : `Receipt ${TONE[latest.status].label}${latest.status === "accepted" ? ` · ${fmtN(latest.amount)}` : ""}`}
      </span>{" "}
      <a href={`/api/proofs/${latest.id}`} target="_blank" rel="noopener" className="font-semibold text-[#055a5b] underline">
        view
      </a>
    </div>
  );
}

/** Every receipt in full, for the Mark paid / Record payment drawers. */
export function ReceiptList({ proofs }: { proofs: PaymentProof[] }) {
  const S = useErp();
  const money = S.canDo("money", "admin");
  if (proofs.length === 0) {
    return <div className="text-[12.5px] text-[#84908f]">No receipt uploaded by the buyer.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] font-semibold text-[#465657]">Receipts from the buyer</div>
      {proofs.map((p) => (
        <div key={p.id} className="rounded-xl border border-[#e4eaea] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{fmtN(p.amount)}</span>
            <Badge label={TONE[p.status].label} bg={TONE[p.status].bg} fg={TONE[p.status].fg} />
          </div>
          <div className="mt-0.5 text-[12.5px] text-[#5d6b6b]">
            {[p.reference && `ref ${p.reference}`, `sent ${when(p.createdAt)}`].filter(Boolean).join(" · ")}
          </div>
          {p.note ? <div className="mt-0.5 text-[12.5px] text-[#465657]">“{p.note}”</div> : null}
          {p.status === "rejected" && p.rejectReason ? (
            <div className="mt-0.5 text-[12.5px] text-[#c7402f]">Not accepted: {p.rejectReason}</div>
          ) : null}
          <div className="mt-1.5 flex gap-3">
            <a
              href={`/api/proofs/${p.id}`}
              target="_blank"
              rel="noopener"
              className="text-[12.5px] font-semibold text-[#055a5b] underline"
            >
              Open {p.mimeType === "application/pdf" ? "PDF" : "image"}
            </a>
            {money && p.status === "submitted" ? (
              <button
                type="button"
                disabled={S.saving}
                onClick={() => {
                  const reason = window.prompt("Why isn't this receipt accepted? The buyer sees this.");
                  if (reason && reason.trim()) void S.rejectProof(p.id, reason.trim());
                }}
                className="text-[12.5px] font-semibold text-[#b3473a]"
              >
                Not accepted…
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * "Upload receipt" for staff, on a buyer's behalf. Admins of egg sales or
 * money always can; sales staff only for buyers an admin has allowed.
 */
export function StaffUpload({
  kind,
  id,
  due,
  customerId,
}: {
  kind: "order" | "invoice";
  id: number;
  due: number;
  customerId: number;
}) {
  const S = useErp();
  const admin = S.canDo("eggsales", "admin") || S.canDo("money", "admin");
  const allowed = admin || (S.canDo("eggsales") && S.customers.find((c) => c.id === customerId)?.staffReceipts);
  if (!allowed) return null;
  return <UploadReceipt kind={kind} id={id} due={due} endpoint="/api/erp/proofs" label="upload receipt" small />;
}
