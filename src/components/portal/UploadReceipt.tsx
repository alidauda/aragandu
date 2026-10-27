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

/** What their receipts still waiting to be checked add up to. */
export const sentFor = (proofs: PortalProof[], target: { orderId: number } | { invoiceId: number }) =>
  receiptsFor(proofs, target)
    .filter((p) => p.status === "submitted")
    .reduce((a, p) => a + p.amount, 0);

/** Under an unpaid row: where their receipts stand — several can make up one payment. */
export function ReceiptStatus({ proofs }: { proofs: PortalProof[] }) {
  if (proofs.length === 0) return null;
  const open = proofs.filter((p) => p.status === "submitted");
  const links = (list: PortalProof[]) =>
    list.map((p, i) => (
      <a
        key={p.id}
        href={`/api/proofs/${p.id}`}
        target="_blank"
        rel="noopener"
        className="ml-1.5 font-semibold text-[#055a5b] underline"
      >
        {list.length > 1 ? `view ${i + 1}` : "view"}
      </a>
    ));
  if (open.length) {
    const total = open.reduce((a, p) => a + p.amount, 0);
    return (
      <div className="mt-1 text-[12px] text-[#5d6b6b]">
        {open.length > 1 ? `${open.length} receipts sent` : "Receipt sent"} · {naira.format(total)} — the farm is checking
        {links([...open].reverse())}
      </div>
    );
  }
  const last = proofs[0];
  if (last.status === "rejected") {
    return (
      <div className="mt-1 text-[12px] text-[#c7402f]">
        Receipt not accepted{last.rejectReason ? `: ${last.rejectReason}` : ""} — send another.
      </div>
    );
  }
  const accepted = proofs.filter((p) => p.status === "accepted");
  return (
    <div className="mt-1 text-[12px] text-[#5d6b6b]">
      {accepted.length > 1 ? `${accepted.length} receipts accepted ✓` : "Receipt accepted ✓"}
      {links([...accepted].reverse())}
    </div>
  );
}

type Row = { key: number; file: File; amount: string; reference: string; error?: string };
let nextKey = 1;

/**
 * "Upload receipt": proof of a payment made outside the app — one receipt
 * or several (a payment split into transfers because of bank limits), each
 * a photo, screenshot or PDF with its own amount and reference.
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
  /** What's left to pay (less any receipts already waiting to be checked). */
  due: number;
  label?: string;
  /** Staff upload for a buyer through the ERP's own endpoint. */
  endpoint?: string;
  /** A text link rather than a button (ERP rows). */
  small?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const buyer = endpoint === "/api/portal/proofs";

  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added = [...files].map((file) => ({ key: nextKey++, file, amount: "", reference: "" }));
    setRows((now) => {
      const all = [...now, ...added];
      // One receipt for the whole amount: fill it in; several: they say how much each was.
      if (all.length === 1 && due > 0) all[0] = { ...all[0], amount: String(due) };
      return all;
    });
    setError("");
  };
  const update = (key: number, change: Partial<Row>) =>
    setRows((now) => now.map((r) => (r.key === key ? { ...r, ...change, error: undefined } : r)));

  const submit = async () => {
    if (rows.length === 0) return setError("Choose the receipt — a photo, screenshot or PDF.");
    const bad = rows.find((r) => r.file.size > MAX_MB * 1024 * 1024 || !(Number(r.amount) > 0));
    if (bad) {
      return setError(
        bad.file.size > MAX_MB * 1024 * 1024
          ? `${bad.file.name} is over ${MAX_MB} MB — take a smaller photo or screenshot.`
          : "Enter the amount paid on each receipt."
      );
    }
    setBusy(true);
    setError("");
    // One request per receipt, so each stays within the upload limit; any
    // that fail stay in the list with the reason.
    const left: Row[] = [];
    for (const r of rows) {
      const body = new FormData();
      body.set("file", r.file);
      body.set("kind", kind);
      body.set("id", String(id));
      body.set("amount", r.amount);
      body.set("reference", r.reference);
      body.set("note", note);
      const res = await fetch(endpoint, { method: "POST", body })
        .then((x) => x.json() as Promise<{ ok: boolean; error?: string }>)
        .catch(() => ({ ok: false, error: "Couldn't upload — check your connection and try again." }));
      if (!res.ok) left.push({ ...r, error: res.error ?? "Couldn't upload this one." });
    }
    setBusy(false);
    router.refresh();
    if (left.length) {
      setRows(left);
      return setError(
        left.length === rows.length ? "The receipts weren't sent." : `${rows.length - left.length} sent; the rest weren't.`
      );
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRows([]);
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
        title={buyer ? "Upload your payment receipts" : "Upload the buyer's receipts"}
        sub={
          buyer
            ? "Paid in more than one transfer? Add a receipt for each — a photo, screenshot or the bank's PDF. The farm checks them and confirms your payment."
            : "The receipts they sent you (WhatsApp, email, a photo of the slip) — one per transfer. They're kept with the order for whoever confirms the payment."
        }
        onSubmit={() => void submit()}
        submitLabel={busy ? "Uploading…" : rows.length > 1 ? `Send ${rows.length} receipts` : "Send receipt"}
        busy={busy}
      >
        {rows.map((r, i) => (
          <div key={r.key} className={`rounded-xl border px-3 py-3 ${r.error ? "border-[#f0cfc9]" : "border-[#e4eaea]"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[13.5px] font-semibold text-[#0d1d1d]">
                {rows.length > 1 ? `${i + 1}. ` : ""}
                {r.file.name}
              </span>
              <button
                type="button"
                onClick={() => setRows((now) => now.filter((x) => x.key !== r.key))}
                disabled={busy}
                className="shrink-0 text-[12px] font-semibold text-[#b3473a]"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <label className="block">
                <div className="mb-1 text-[12.5px] font-semibold text-[#465657]">Amount (₦)</div>
                <input
                  type="number"
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value })}
                  className={field}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[12.5px] font-semibold text-[#465657]">Reference (optional)</div>
                <input
                  value={r.reference}
                  onChange={(e) => update(r.key, { reference: e.target.value })}
                  placeholder="Bank ref / session ID"
                  className={field}
                />
              </label>
            </div>
            {r.error ? <div className="mt-1.5 text-[12.5px] text-[#c7402f]">{r.error}</div> : null}
          </div>
        ))}

        <label className="block cursor-pointer rounded-xl border border-dashed border-[#c5dcd9] px-3 py-3 text-center text-[13.5px] font-semibold text-[#055a5b] hover:bg-[#f3f8f7]">
          {rows.length ? "+ Add another receipt" : "Choose receipts"}
          <span className="block text-[12px] font-normal text-[#84908f]">
            JPEG, PNG, WebP or PDF · up to {MAX_MB} MB each · pick several at once if you like
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>

        {rows.length ? (
          <div className="flex items-baseline justify-between rounded-[10px] bg-[#f4f6f5] px-3 py-2.5 text-[13.5px]">
            <span className="text-[#465657]">
              {rows.length > 1 ? `${rows.length} receipts` : "Receipt"} total
            </span>
            <span>
              <span className="font-semibold text-[#0d1d1d]">{naira.format(total)}</span>
              {due > 0 ? (
                <span className={`ml-1.5 text-[12.5px] ${total === due ? "text-[#016559]" : "text-[#9a6a12]"}`}>
                  of {naira.format(due)}
                  {total === due ? " ✓" : total < due ? ` · ${naira.format(due - total)} short` : ` · ${naira.format(total - due)} over`}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <label className="block">
          <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Note for the farm (optional)</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={buyer ? "Paid in 3 transfers from our GTBank account" : "Sent on WhatsApp"}
            className={field}
          />
        </label>
        <FormError message={error} />
      </Drawer>
    </>
  );
}
