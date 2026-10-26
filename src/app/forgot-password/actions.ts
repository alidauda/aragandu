"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { mailPasswordReset } from "@/lib/mail";
import { createResetLink, resetAskedJustNow } from "@/lib/password-reset";

export type ResetRequest = { ok: true } | { ok: false; error: string };

/**
 * "Forgot password?": emails a one-hour link to choose a new password. The
 * answer is the same whether or not the email has an account — except
 * when the email service refuses the message, which is said plainly
 * rather than promising an email that never comes.
 */
export async function requestPasswordReset(rawEmail: string): Promise<ResetRequest> {
  const parsed = z.email().safeParse(rawEmail.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, name: true, email: true, role: true, disabled: true },
  });
  // No account, or access removed: no way back in by email.
  if (!user || user.disabled) return { ok: true };
  if (await resetAskedJustNow(user.id)) {
    return { ok: false, error: "A link was just sent — wait a minute before asking again." };
  }
  const url = await createResetLink(user);
  const sent = await mailPasswordReset({ email: user.email, name: user.name, url }).catch(() => ({ ok: false }));
  if (!sent.ok) {
    return {
      ok: false,
      error: "We couldn't send the reset email just now. Try again later, or ask the farm office for a reset link.",
    };
  }
  return { ok: true };
}
