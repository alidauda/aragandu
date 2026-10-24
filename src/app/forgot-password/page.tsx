import type { Metadata } from "next";

import { ForgotPassword } from "@/components/PasswordReset";
import { emailEnabled } from "@/lib/email";

export const metadata: Metadata = { title: "Forgot password — Argandu Farms" };

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const { for: from } = await props.searchParams;
  return <ForgotPassword portal={from === "portal"} emailOn={emailEnabled()} />;
}
