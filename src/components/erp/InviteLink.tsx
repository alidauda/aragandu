"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";

/**
 * The invite link, shown once after it's created. Staff copy it and send
 * it however they like (WhatsApp, SMS, email); it isn't retrievable later.
 */
export function InviteLink({ path, email }: { path: string; email: string }) {
  const S = useErp();
  const url = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState(false);

  const sendEmail = async () => {
    const r = await S.emailInvite(path);
    if (r.ok) setEmailed(true);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[13px] text-[#4c5a51]">
        Send this link to <span className="font-semibold text-[#14231a]">{email}</span>.
        It works once and expires in 7 days.
      </div>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="font-data min-w-0 flex-1 rounded-lg border border-[#dce1da] bg-[#f4f6f3] px-3 py-2 text-[12px] text-[#14231a]"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg bg-[#2f8f46] px-3.5 text-[12.5px] font-bold text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {S.emailEnabled ? (
        <button
          type="button"
          onClick={() => void sendEmail()}
          disabled={S.saving || emailed}
          className="self-start rounded-lg border border-[#dce1da] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2f8f46] disabled:opacity-60"
        >
          {emailed ? `Emailed to ${email} ✓` : `Email it to ${email}`}
        </button>
      ) : null}
      <div className="text-[12px] text-[#8b958d]">
        You won&apos;t see this link again. Lost it? Create a new invite — it replaces this one.
      </div>
    </div>
  );
}
