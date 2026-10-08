"use client";

import { useState, useTransition } from "react";

import { acceptInviteAction } from "@/app/invite/actions";

/** Where an invite link lands: choose a password, and you're in. */
export function AcceptInvite({
  token,
  email,
  name,
  role,
}: {
  token: string;
  email: string;
  name: string;
  role: "staff" | "customer";
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, startBusy] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError("");
    startBusy(async () => {
      // On success the action redirects, so a result means it failed.
      const r = await acceptInviteAction({ token, password, confirm });
      if (r && !r.ok) setError(r.error);
    });
  };

  const field =
    "mt-1.5 w-full rounded-lg border border-[#cfd3bd] bg-white px-3 py-2.5 text-[14px] text-[#1c2214] outline-none focus:border-[#3c4d28]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#dfe2d2] bg-white p-8"
      >
        <div className="font-display text-xl font-bold tracking-[0.5px] text-[#1c2214]">
          Argandu Farms
        </div>
        <p className="mt-2 text-[13.5px] text-[#6c7359]">
          {role === "staff"
            ? `Welcome, ${name}. Choose a password for your staff account.`
            : `Choose a password to order for ${name} on the buyer portal.`}
        </p>

        <label className="mt-6 block text-[12.5px] font-semibold text-[#59614a]">
          Email (your sign-in name)
          <input value={email} readOnly className={`${field} bg-[#f4f5ec] text-[#59614a]`} />
        </label>
        <label className="mt-4 block text-[12.5px] font-semibold text-[#59614a]">
          Password (8+ characters)
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        <label className="mt-4 block text-[12.5px] font-semibold text-[#59614a]">
          Confirm password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
        </label>

        {error ? <p className="mt-3 text-[13px] text-[#b3402f]">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-[#3c4d28] px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Setting up…" : "Create my account"}
        </button>
      </form>
    </main>
  );
}
