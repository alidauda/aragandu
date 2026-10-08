"use client";

import { useState } from "react";

/**
 * The invite link, shown once after it's created. Staff copy it and send
 * it however they like (WhatsApp, SMS, email); it isn't retrievable later.
 */
export function InviteLink({ path, email }: { path: string; email: string }) {
  const url = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[13px] text-[#59614a]">
        Send this link to <span className="font-semibold text-[#1c2214]">{email}</span>.
        It works once and expires in 7 days.
      </div>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="font-data min-w-0 flex-1 rounded-lg border border-[#cfd3bd] bg-[#f4f5ec] px-3 py-2 text-[12px] text-[#1c2214]"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg bg-[#3c4d28] px-3.5 text-[12.5px] font-bold text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className="text-[12px] text-[#8a9070]">
        You won&apos;t see this link again. Lost it? Create a new invite — it replaces this one.
      </div>
    </div>
  );
}
