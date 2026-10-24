import type { Metadata } from "next";

import { ResetPassword } from "@/components/PasswordReset";

export const metadata: Metadata = { title: "Choose a new password — Argandu Farms" };

/** Opened from the reset email: /reset-password?token=…(&for=portal). */
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token, for: from, error } = await props.searchParams;
  return (
    <ResetPassword
      token={typeof token === "string" && !error ? token : ""}
      portal={from === "portal"}
    />
  );
}
