"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { AuthFrame } from "@/components/AuthFrame";
import { Logo } from "@/components/Logo";

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
          : error.status === 403
            ? "This account's access has been removed. Contact the farm."
            : "Sign-in failed. Check your email and password."
      );
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  const field =
    "mt-1.5 w-full rounded-lg border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] text-[#0d1d1d] outline-none focus:border-[#055a5b]";

  return (
    <AuthFrame>
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] rounded-2xl border border-[#e4eaea] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(5,70,71,0.35)]"
      >
        <Logo caption="Farm ERP" />
        <h1 className="font-display mt-7 text-[26px] font-bold text-[#0d1d1d]">Sign in</h1>
        <p className="mt-1 text-[14px] text-[#5d6b6b]">Use the staff account the farm set up for you.</p>

        {notice ? (
          <p className="mt-4 rounded-lg bg-[#e2f0ed] px-3 py-2 text-[13px] text-[#016559]">
            {notice}
          </p>
        ) : null}

        <label className="mt-6 block text-[12.5px] font-semibold text-[#465657]">
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
        <label className="mt-4 block text-[12.5px] font-semibold text-[#465657]">
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

        <div className="mt-2 text-right">
          <a href="/forgot-password" className="text-[12.5px] font-semibold text-[#055a5b] hover:underline">
            Forgot password?
          </a>
        </div>

        {error ? <p className="mt-3 text-[13px] text-[#c7402f]">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-[#055a5b] px-4 py-2.5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-[12px] text-[#84908f]">
          Buying eggs? Use the <a href="/portal" className="underline">buyer portal</a>.
        </p>
      </form>
    </AuthFrame>
  );
}
