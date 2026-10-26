"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { Drawer, FormError, TextField } from "@/components/erp/Drawer";

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
        type="button"
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

/**
 * "Set password": an admin types a new password for someone and tells them
 * it. They're signed out everywhere and emailed that it changed.
 */
export function SetPassword({ userId, email }: { userId: string; email: string }) {
  const S = useErp();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    if (done) return setOpen(false);
    if (pw.next.length < 8) return setError("The password needs at least 8 characters.");
    if (pw.next !== pw.confirm) return setError("The two passwords don't match.");
    setError("");
    const r = await S.setUserPassword(userId, pw.next);
    if (!r.ok) return setError(r.error);
    setDone(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPw({ next: "", confirm: "" });
          setError("");
          setDone(false);
          setOpen(true);
        }}
        disabled={S.saving}
        title="Choose a new password for them"
        className="text-[11.5px] font-semibold text-[#055a5b] opacity-70 hover:opacity-100"
      >
        set password
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Set a new password"
        sub={`For ${email}`}
        onSubmit={() => void save()}
        submitLabel={done ? "Done" : "Set password"}
      >
        {done ? (
          <div className="rounded-lg bg-[#e2f0ed] px-3 py-2.5 text-[13.5px] text-[#016559]">
            Password changed ✓ — tell them the new password (in person or on WhatsApp). They&apos;ve been signed
            out everywhere{S.emailEnabled ? " and emailed that it changed" : ""}, and can change it themselves
            after signing in.
          </div>
        ) : (
          <>
            <TextField
              label="New password"
              type="password"
              value={pw.next}
              onChange={(v) => setPw({ ...pw, next: v })}
              placeholder="At least 8 characters"
            />
            <TextField
              label="Type it again"
              type="password"
              value={pw.confirm}
              onChange={(v) => setPw({ ...pw, confirm: v })}
            />
            <div className="-mt-1 text-[12px] text-[#84908f]">
              Prefer <span className="font-semibold">reset link</span> when you can — they choose their own
              password and you never know it.
            </div>
            <FormError message={error} />
          </>
        )}
      </Drawer>
    </>
  );
}
