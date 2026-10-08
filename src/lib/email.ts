import "server-only";

/**
 * Outgoing email through Resend (https://resend.com). Off until both
 * RESEND_API_KEY and EMAIL_FROM are set — every caller checks
 * `emailEnabled()` and the app works the same without it.
 */

const API_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** The public origin for links in emails. */
export const appUrl = () => (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

export async function sendEmail(msg: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailEnabled()) return { ok: false, error: "Email isn't set up yet." };
  if (msg.to.length === 0) return { ok: false, error: "No email address to send to." };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });
    if (!res.ok) {
      console.error("email send failed", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "The email service refused the message." };
    }
    return { ok: true };
  } catch (e) {
    console.error("email send failed", e);
    return { ok: false, error: "Couldn't reach the email service." };
  }
}

/** Minimal escaping for values dropped into email HTML. */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
