"use client";

import { useState } from "react";

import { requestPasswordReset } from "@/app/forgot-password/actions";
import { authClient } from "@/lib/auth-client";
import { AuthFrame } from "@/components/AuthFrame";
import { Logo } from "@/components/Logo";

/** "Forgot password?" and the page its emailed link opens. */

const field =
  "mt-1.5 w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] text-[#0d1d1d] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15";
const button =
  "mt-6 w-full rounded-[10px] bg-[#055a5b] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#044647] disabled:opacity-50";

function Frame({ caption, title, sub, children }: { caption: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <AuthFrame variant={caption === "Buyer portal" ? "poultry" : "farm"}>
      <div className="w-full max-w-[400px] rounded-2xl border border-[#e4eaea] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(5,70,71,0.35)]">
        {caption === "Buyer portal" ? <Logo tone="poultry" division="POULTRY" caption={caption} /> : <Logo caption={caption} />}
        <h1 className="font-display mt-7 text-[26px] font-bold text-[#0d1d1d]">{title}</h1>
        <p className="mt-1 text-[14px] text-[#5d6b6b]">{sub}</p>
        {children}
      </div>
    </AuthFrame>
  );
}

const signInHref = (portal: boolean) => (portal ? "/portal" : "/login");

export function ForgotPassword({ portal, emailOn }: { portal: boolean; emailOn: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const caption = portal ? "Buyer portal" : "Farm ERP";

  if (!emailOn) {
    return (
      <Frame caption={caption} title="Forgot your password?" sub="Password reset by email isn't switched on yet.">
        <p className="mt-5 text-[14px] text-[#465657]">
          Ask the farm office to send you a new invite link — it lets you choose a new password.
        </p>
        <a href={signInHref(portal)} className="mt-6 block text-center text-[13px] font-semibold text-[#055a5b]">
          ← Back to sign in
        </a>
      </Frame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await requestPasswordReset(email).catch(() => ({
      ok: false as const,
      error: "Couldn't reach the server. Check your connection and try again.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    // Same answer whether or not the email has an account.
    setSent(true);
  };

  return (
    <Frame
      caption={caption}
      title="Forgot your password?"
      sub="Enter your email and we'll send you a link to choose a new one."
    >
      {sent ? (
        <p className="mt-5 rounded-[10px] bg-[#e2f0ed] px-3 py-3 text-[14px] text-[#016559]">
          If <strong>{email.trim()}</strong> has an account, a reset link is on its way. It works once, within 1
          hour — check your spam folder too.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className="mt-6 block text-[13px] font-semibold text-[#465657]">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="you@business.com"
            />
          </label>
          {error ? <p className="mt-3 text-[13px] text-[#c7402f]">{error}</p> : null}
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <a href={signInHref(portal)} className="mt-5 block text-center text-[13px] font-semibold text-[#055a5b]">
        ← Back to sign in
      </a>
    </Frame>
  );
}

export function ResetPassword({ token, portal }: { token: string; portal: boolean }) {
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(token ? "" : "expired");
  const caption = portal ? "Buyer portal" : "Farm ERP";
  const forgot = portal ? "/forgot-password?for=portal" : "/forgot-password";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) return setError("The new password needs at least 8 characters.");
    if (pw.next !== pw.confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const { error } = await authClient.resetPassword({ newPassword: pw.next, token });
    setBusy(false);
    if (!error) return setDone(true);
    setError(error.status === 400 ? "expired" : "Couldn't change the password. Please try again.");
  };

  if (done) {
    return (
      <Frame caption={caption} title="Password changed" sub="You can sign in with your new password now.">
        <a href={signInHref(portal)} className={`${button} block text-center`}>
          Sign in
        </a>
      </Frame>
    );
  }
  if (error === "expired") {
    return (
      <Frame caption={caption} title="This link has expired" sub="Reset links work once, within 1 hour.">
        <a href={forgot} className={`${button} block text-center`}>
          Send a new link
        </a>
      </Frame>
    );
  }
  return (
    <Frame caption={caption} title="Choose a new password" sub="At least 8 characters. Your other devices will be signed out.">
      <form onSubmit={submit}>
        <label className="mt-6 block text-[13px] font-semibold text-[#465657]">
          New password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            className={field}
          />
        </label>
        <label className="mt-4 block text-[13px] font-semibold text-[#465657]">
          Confirm new password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            className={field}
          />
        </label>
        {error ? <p className="mt-3 text-[13px] text-[#c7402f]">{error}</p> : null}
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </Frame>
  );
}
