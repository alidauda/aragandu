"use client";

import { useState, useTransition } from "react";

import { emailInvoice } from "@/lib/erp/actions";

/** Staff: send the buyer their invoice (needs email set up). */
export function EmailInvoiceButton({ invoiceId }: { invoiceId: number }) {
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {msg ? <span className="text-sm text-stone-600">{msg}</span> : null}
      <button
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await emailInvoice(invoiceId);
            setMsg(r.ok ? "Sent ✓" : r.error);
          })
        }
        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Email to buyer"}
      </button>
    </span>
  );
}
