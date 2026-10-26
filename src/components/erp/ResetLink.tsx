"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { Drawer, FormError } from "@/components/erp/Drawer";

/**
 * "Reset link": for someone whose reset email doesn't arrive. Makes a
 * one-hour link to choose a new password, to copy and send on WhatsApp.
 */
export function ResetLink({ userId, email }: { userId: string; email: string }) {
  const S = useErp();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const make = async () => {
    setError("");
    setUrl(null);
    setOpen(true);
    const r = await S.passwordResetLink(userId);
    if (r.ok) setUrl(r.data.url);
    else setError(r.error);
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => void make()}
        disabled={S.saving}
        title="A link to choose a new password, to send by hand"
        className="text-[11.5px] font-semibold text-[#055a5b] opacity-70 hover:opacity-100"
      >
        reset link
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Password reset link"
        sub={`For ${email} — send it on WhatsApp or SMS`}
        onSubmit={() => setOpen(false)}
        submitLabel="Done"
      >
        {url ? (
          <div className="flex flex-col gap-2.5">
            <div className="text-[13px] text-[#465657]">
              Opening it lets them choose a new password. It works once and expires in 1 hour. Anyone with the
              link can set the password, so send it only to them.
            </div>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-data min-w-0 flex-1 rounded-lg border border-[#d6dfde] bg-[#f4f6f5] px-3 py-2 text-[12px] text-[#0d1d1d]"
              />
              <button
                type="button"
                onClick={() => void copy()}
                className="shrink-0 rounded-lg bg-[#055a5b] px-3.5 text-[12.5px] font-bold text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        ) : error ? null : (
          <div className="text-[13px] text-[#84908f]">Making the link…</div>
        )}
        <FormError message={error} />
      </Drawer>
    </>
  );
}
