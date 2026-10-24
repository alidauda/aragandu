"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/Logo";

/** "Forgot password?" and the page its emailed link opens. */

const field =
  "mt-1.5 w-full rounded-[10px] border border-[#dce1da] bg-white px-3 py-2.5 text-[14px] text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-2 focus:ring-[#2f8f46]/15";
const button =
  "mt-6 w-full rounded-[10px] bg-[#2f8f46] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#27793b] disabled:opacity-50";

function Frame({ caption, title, sub, children }: { caption: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f3] p-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-[#e7ebe6] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(16,58,34,0.35)]">
        <Logo caption={caption} />
        <h1 className="font-display mt-7 text-[26px] font-bold text-[#14231a]">{title}</h1>
        <p className="mt-1 text-[14px] text-[#647067]">{sub}</p>
        {children}
      </div>
    </main>
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
        <p className="mt-5 text-[14px] text-[#4c5a51]">
          Ask the farm office to send you a new invite link — it lets you choose a new password.
        </p>
        <a href={signInHref(portal)} className="mt-6 block text-center text-[13px] font-semibold text-[#2f8f46]">
          ← Back to sign in
        </a>
      </Frame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: portal ? "/reset-password?for=portal" : "/reset-password",
    });
    setBusy(false);
    if (error?.status === 429) return setError("Too many attempts. Wait a minute and try again.");
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
        <p className="mt-5 rounded-[10px] bg-[#e7f4ea] px-3 py-3 text-[14px] text-[#23753a]">
          If <strong>{email.trim()}</strong> has an account, a reset link is on its way. It works once, within 1
          hour — check your spam folder too.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className="mt-6 block text-[13px] font-semibold text-[#4c5a51]">
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
      <a href={signInHref(portal)} className="mt-5 block text-center text-[13px] font-semibold text-[#2f8f46]">
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
        <label className="mt-6 block text-[13px] font-semibold text-[#4c5a51]">
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
        <label className="mt-4 block text-[13px] font-semibold text-[#4c5a51]">
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
