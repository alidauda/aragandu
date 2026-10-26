"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { naira, type PortalProof } from "@/lib/orders";
import { Drawer, FormError } from "@/components/erp/Drawer";

const MAX_MB = 5;
const field =
  "w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";

/** The buyer's receipts for one order or invoice, newest first. */
export const receiptsFor = (proofs: PortalProof[], target: { orderId: number } | { invoiceId: number }) =>
  proofs.filter((p) => ("orderId" in target ? p.orderId === target.orderId : p.invoiceId === target.invoiceId));

/** Under an unpaid row: where their last receipt stands. */
export function ReceiptStatus({ proofs }: { proofs: PortalProof[] }) {
  const last = proofs[0];
  if (!last) return null;
  if (last.status === "rejected") {
    return (
      <div className="mt-1 text-[12px] text-[#c7402f]">
        Receipt not accepted{last.rejectReason ? `: ${last.rejectReason}` : ""} — send another.
      </div>
    );
  }
  return (
    <div className="mt-1 text-[12px] text-[#5d6b6b]">
      {last.status === "accepted" ? "Receipt accepted ✓" : `Receipt sent · ${naira.format(last.amount)} — the farm is checking it`}{" "}
      <a href={`/api/proofs/${last.id}`} target="_blank" rel="noopener" className="font-semibold text-[#055a5b] underline">
        view
      </a>
    </div>
  );
}

/**
 * "Upload receipt": proof of a payment made outside the app (a photo or
 * screenshot of the transfer, or a PDF), with the amount and reference.
 */
export function UploadReceipt({
  kind,
  id,
  due,
  label = "Upload receipt",
  endpoint = "/api/portal/proofs",
  small = false,
}: {
  kind: "order" | "invoice";
  id: number;
  due: number;
  label?: string;
  /** Staff upload for a buyer through the ERP's own endpoint. */
  endpoint?: string;
  /** A text link rather than a button (ERP rows). */
  small?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(String(due));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!file) return setError("Choose the receipt — a photo, screenshot or PDF.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB — take a smaller photo or screenshot.`);
    if (!(Number(amount) > 0)) return setError("Enter the amount you paid.");
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    body.set("id", String(id));
    body.set("amount", amount);
    body.set("reference", reference);
    body.set("note", note);
    const r = await fetch(endpoint, { method: "POST", body })
      .then((res) => res.json() as Promise<{ ok: boolean; error?: string }>)
      .catch(() => ({ ok: false, error: "Couldn't upload — check your connection and try again." }));
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Couldn't upload the receipt.");
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFile(null);
          setAmount(String(due));
          setReference("");
          setNote("");
          setError("");
          setOpen(true);
        }}
        className={
          small
            ? "text-[12px] font-semibold text-[#055a5b] underline"
            : "rounded-[10px] bg-[#055a5b] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#044647]"
        }
      >
        {label}
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={endpoint === "/api/portal/proofs" ? "Upload your payment receipt" : "Upload the buyer's receipt"}
        sub={
          endpoint === "/api/portal/proofs"
            ? "A photo or screenshot of the transfer, or the PDF your bank gave you. The farm checks it and confirms your payment."
            : "The receipt they sent you (WhatsApp, email, a photo of the slip). It's kept with the order for whoever confirms the payment."
        }
        onSubmit={() => void submit()}
        submitLabel={busy ? "Uploading…" : "Send receipt"}
        busy={busy}
      >
        <label className="block">
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Receipt (JPEG, PNG, WebP or PDF, up to {MAX_MB} MB)</div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-[13.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e3efee] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-[#044647]"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Amount paid (₦)</div>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className="block">
            <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Reference (optional)</div>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank ref / session ID"
              className={field}
            />
          </label>
        </div>
        <label className="block">
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Note for the farm (optional)</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid from Kano Fresh Foods account" className={field} />
        </label>
        <FormError message={error} />
      </Drawer>
    </>
  );
}
