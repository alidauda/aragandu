"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

/** Staff sign-in, in the ERP's own dress. Accounts are issued, not signed up. */
export function StaffSignIn({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a few seconds and try again."
          : "Sign-in failed. Check your email and password."
      );
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
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
          AFEMS
        </div>
        <div
          className="mt-1.5 h-[5px] w-[26px]"
          style={{
            borderTop: "1px solid #4a5d33",
            borderBottom: "3px double #4a5d33",
          }}
        />
        <p className="mt-3 text-[13.5px] text-[#6c7359]">
          Farm ERP — sign in with your staff account.
        </p>

        {notice ? (
          <p className="mt-4 rounded-lg bg-[#e8f2e5] px-3 py-2 text-[13px] text-[#3f6f3a]">
            {notice}
          </p>
        ) : null}

        <label className="mt-6 block text-[12.5px] font-semibold text-[#59614a]">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className="mt-4 block text-[12.5px] font-semibold text-[#59614a]">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>

        {error ? <p className="mt-3 text-[13px] text-[#b3402f]">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-[#3c4d28] px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-[12px] text-[#8a9070]">
          Buying eggs? Use the <a href="/portal" className="underline">buyer portal</a>.
        </p>
      </form>
    </main>
  );
}
