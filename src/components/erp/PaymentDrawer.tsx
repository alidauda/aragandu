"use client";

import { useState } from "react";

import { balance, fmtD, fmtN } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import type { PaymentProof } from "@/lib/erp/types";
import { confirmDialog } from "@/components/Dialogs";
import { DayField, Drawer, FieldRow, FormError, SelectField, TextField } from "@/components/erp/Drawer";
import { ReceiptList, proofsFor } from "@/components/erp/Receipts";
import { Recorded } from "@/components/erp/ui";

const METHOD = { transfer: "Bank transfer", cash: "Cash", pos: "POS", credit: "From credit", paystack: "Paystack (online)" } as const;

/** Receipts for an invoice, or for the order it came from. */
export const receiptsOf = (proofs: PaymentProof[], v: { id: number; orderId?: number }) => [
  ...proofsFor(proofs, { invoiceId: v.id }),
  ...(v.orderId ? proofsFor(proofs, { orderId: v.orderId }) : []),
];

/**
 * Recording money against an invoice (money admins): the amount, how it
 * came, and the payments so far. Shared by every page that sells.
 */
export function usePayments() {
  const S = useErp();
  const [payFor, setPayFor] = useState<number | null>(null);
  const [payment, setPayment] = useState({ amount: "", method: "transfer", reference: "", date: "" });
  const [payError, setPayError] = useState("");
  const payInvoice = S.invoices.find((v) => v.id === payFor);
  const payHistory = S.payments.filter((p) => p.invoiceId === payFor);

  const openPay = (id: number) => {
    const v = S.invoices.find((x) => x.id === id)!;
    // A receipt the buyer sent fills in what they said they paid.
    // Receipts the buyer sent (several transfers add up) fill in the amount and references.
    const open = proofsFor(S.proofs, { invoiceId: id })
      .filter((p) => p.status === "submitted")
      .reverse();
    const sent = open.reduce((a, p) => a + p.amount, 0);
    setPayFor(id);
    setPayment({
      amount: v.status === "pending" ? String(sent ? Math.min(sent, balance(v)) : balance(v)) : "",
      method: v.cust === null ? "cash" : "transfer",
      reference: open
        .map((p) => p.reference)
        .filter(Boolean)
        .join(", ")
        .slice(0, 200),
      date: "",
    });
    setPayError("");
  };

  const savePayment = async () => {
    if (!payInvoice) return;
    if (payInvoice.status === "paid") return setPayFor(null);
    const amount = Number(payment.amount);
    if (!(amount > 0)) return setPayError("Enter the amount received.");
    if (payInvoice.cust === null && amount > balance(payInvoice)) {
      return setPayError(`That's more than the ${fmtN(balance(payInvoice))} due; walk-ins can't hold credit.`);
    }
    setPayError("");
    const r = await S.recordPayment({
      invoiceId: payInvoice.id,
      amount,
      method: payment.method as "transfer",
      reference: payment.reference.trim(),
      date: payment.date || undefined,
    });
    if (!r.ok) return setPayError(r.error);
    setPayFor(null);
  };

  const overpay =
    payInvoice && payInvoice.cust !== null && Number(payment.amount) > balance(payInvoice)
      ? Number(payment.amount) - balance(payInvoice)
      : 0;

  return {
    open: openPay,
    drawer: (
          <Drawer
            open={payFor !== null}
            onClose={() => setPayFor(null)}
            title={payInvoice?.status === "paid" ? "Payments" : "Record payment"}
            sub={
              payInvoice
                ? `${payInvoice.name} · ${fmtN(balance(payInvoice))} outstanding of ${fmtN(payInvoice.qty * payInvoice.price)}`
                : ""
            }
            onSubmit={() => void savePayment()}
            submitLabel={payInvoice?.status === "paid" ? "Done" : "Record payment"}
          >
            {payInvoice?.status === "pending" ? (
              <>
                <FieldRow>
                  <TextField
                    label="Amount ₦"
                    type="number"
                    value={payment.amount}
                    onChange={(v) => setPayment({ ...payment, amount: v })}
                  />
                  <SelectField
                    label="Method"
                    value={payment.method}
                    onChange={(v) => setPayment({ ...payment, method: v })}
                    options={[
                      { label: "Bank transfer", value: "transfer" },
                      { label: "Cash", value: "cash" },
                      { label: "POS", value: "pos" },
                    ]}
                  />
                </FieldRow>
                <TextField
                  label="Reference (optional)"
                  value={payment.reference}
                  onChange={(v) => setPayment({ ...payment, reference: v })}
                  placeholder="Transfer ref / receipt no."
                />
                <DayField
                  label="Received on"
                  value={payment.date}
                  onChange={(v) => setPayment({ ...payment, date: v })}
                />
                {overpay > 0 ? (
                  <div className="text-[13px] text-[#465657]">
                    {fmtN(overpay)} over the balance is kept as {payInvoice.name}&apos;s credit.
                  </div>
                ) : null}
              </>
            ) : null}
            {payInvoice && payInvoice.cust !== null ? <ReceiptList proofs={receiptsOf(S.proofs, payInvoice)} /> : null}
            {payHistory.length ? (
              <div>
                <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Payments so far</div>
                {payHistory.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-t border-[#ebf0ef] py-2 text-[13.5px]"
                  >
                    <span>
                      {fmtD(p.date)} · {METHOD[p.method]}
                      {p.reference ? ` · ${p.reference}` : ""}
                      <Recorded at={p.createdAt} date={p.date} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{fmtN(p.amount)}</span>
                      <button
                        type="button"
                        disabled={S.saving}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: `Remove this ${fmtN(p.amount)} payment?`,
                            body: "The invoice's balance goes back up by this amount.",
                            confirmLabel: "Remove payment",
                            danger: true,
                          });
                          if (ok) void S.deletePayment(p.id);
                        }}
                        className="text-[12px] font-semibold text-[#c7402f]"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <FormError message={payError} />
          </Drawer>
    ),
  };
}
