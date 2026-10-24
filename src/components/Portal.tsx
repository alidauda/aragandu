"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { changePassword } from "@/lib/change-password";
import { Logo } from "@/components/Logo";

function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.refresh();
  };
}

/** Signed out: the farm issues every buyer login, so there's no sign-up. */
export function PortalLogin() {
  const router = useRouter();
  // Accepting an invite lands here with ?created=1.
  const notice = useSearchParams().get("created")
    ? "Your account is ready — sign in to start ordering."
    : undefined;
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
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f3] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] rounded-2xl border border-[#e7ebe6] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(16,58,34,0.35)]"
      >
        <Logo caption="Buyer portal" />
        <h1 className="font-display mt-7 text-[26px] font-bold text-[#14231a]">Sign in</h1>
        <p className="mt-1 text-sm text-[#647067]">
          Use the account the farm created for you.
        </p>

        {notice ? (
          <p className="mt-4 rounded-[10px] bg-[#e7f4ea] px-3 py-2 text-sm text-[#23753a]">
            {notice}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-[#4c5a51]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
            placeholder="you@business.com"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#4c5a51]">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[10px] bg-[#2f8f46] px-4 py-2.5 font-semibold text-white transition hover:bg-[#27793b] disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

/** The buyer's own password change; other devices are signed out. */
export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const err = await changePassword(pw.current, pw.next, pw.confirm);
    setBusy(false);
    if (err) return setError(err);
    setDone(true);
  };

  const input =
    "mt-1 w-full rounded-[10px] border border-[#dce1da] px-3 py-2 text-[#14231a] outline-none focus:border-[#2f8f46] focus:ring-1 focus:ring-[#2f8f46]/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14231a]/30 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#e7ebe6] bg-white p-6 shadow-lg"
      >
        <h2 className="text-base font-bold text-[#14231a]">Change password</h2>
        {done ? (
          <p className="mt-3 text-sm text-[#23753a]">Password changed.</p>
        ) : (
          <>
            {(
              [
                ["current", "Current password"],
                ["next", "New password (8+ characters)"],
                ["confirm", "Confirm new password"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mt-4 block text-sm font-medium text-[#4c5a51]">
                {label}
                <input
                  type="password"
                  required
                  autoComplete={key === "current" ? "current-password" : "new-password"}
                  value={pw[key]}
                  onChange={(e) => setPw({ ...pw, [key]: e.target.value })}
                  className={input}
                />
              </label>
            ))}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-[10px] border border-[#dce1da] px-4 py-2 font-semibold text-[#4c5a51]"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {done ? null : (
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-[10px] bg-[#2f8f46] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Change"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Signed in, but not as a buyer (e.g. staff, or an unlinked login). */
export function NotABuyer() {
  const signOut = useSignOut();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f6f3] p-6 text-center">
      <p className="max-w-md text-[#647067]">
        This portal is for verified buyers. Staff should sign in to the ERP at /login —
        ask the farm to set your account up as a buyer if that&apos;s wrong.
      </p>
      <button
        onClick={() => void signOut()}
        className="rounded-[10px] border border-[#dce1da] px-4 py-2 font-semibold text-[#4c5a51]"
      >
        Sign out
      </button>
    </main>
  );
}
