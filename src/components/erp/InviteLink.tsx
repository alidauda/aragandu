"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";

/**
 * The invite link, shown once after it's created. With email on it has
 * already been emailed; staff can also copy it and send it another way
 * (WhatsApp, SMS). It isn't retrievable later.
 */
export function InviteLink({ path, email, emailed: sentAlready = false }: { path: string; email: string; emailed?: boolean }) {
  const S = useErp();
  const url = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState(sentAlready);
  const [resent, setResent] = useState(false);

  const sendEmail = async () => {
    const r = await S.emailInvite(path);
    if (r.ok) {
      setEmailed(true);
      setResent(true);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {emailed ? (
        <div className="rounded-lg bg-[#e2f0ed] px-3 py-2 text-[13px] text-[#016559]">
          Invite emailed to <span className="font-semibold">{email}</span> ✓ — they choose their password from
          the link. You can also copy it and send it on WhatsApp.
        </div>
      ) : (
        <div className="text-[13px] text-[#465657]">
          Send this link to <span className="font-semibold text-[#0d1d1d]">{email}</span>.
          It works once and expires in 7 days.
        </div>
      )}
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
      {S.emailEnabled ? (
        <button
          type="button"
          onClick={() => void sendEmail()}
          disabled={S.saving || resent}
          className="self-start rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b] disabled:opacity-60"
        >
          {resent ? `Sent again ✓` : emailed ? "Email it again" : `Email it to ${email}`}
        </button>
      ) : null}
      <div className="text-[12px] text-[#84908f]">
        You won&apos;t see this link again. Lost it? Create a new invite — it replaces this one.
      </div>
    </div>
  );
}
