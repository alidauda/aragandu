import "server-only";

import { prisma } from "@/lib/db";

/**
 * Outgoing email: invites, invoices, order and payment alerts. Two
 * providers, whichever is configured (Zoho first):
 * - Zoho CPaaS / ZeptoMail — ZOHO_EMAIL_API_KEY ("Zoho-enczapikey …")
 * - Resend — RESEND_API_KEY
 * Both need EMAIL_FROM, a sender on the provider's verified domain, e.g.
 * "Argandu Farms <noreply@argandufarms.com.ng>". With neither set, email is
 * off — every caller checks `emailEnabled()` and the app works the same.
 */

const ZOHO_URL = `https://${process.env.ZOHO_EMAIL_HOST ?? "cpaas.zoho.com"}/v1.1/email`;
const RESEND_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

const provider = () =>
  process.env.ZOHO_EMAIL_API_KEY ? "zoho" : process.env.RESEND_API_KEY ? "resend" : null;

export const emailEnabled = () => Boolean(provider() && process.env.EMAIL_FROM);

/** The public origin for links in emails. */
export const appUrl = () => (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

/** "Name <addr@x>" → { name, address }; a bare address has no name. */
function sender(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, ""), address: m[2] } : { name: "", address: from.trim() };
}

const textToHtml = (text: string) => `<div style="white-space:pre-wrap;font-family:sans-serif">${esc(text)}</div>`;

function request(msg: { to: string[]; subject: string; text: string; html?: string }): {
  url: string;
  headers: Record<string, string>;
  body: unknown;
} {
  const from = process.env.EMAIL_FROM!;
  if (provider() === "zoho") {
    const key = process.env.ZOHO_EMAIL_API_KEY!.trim();
    const { name, address } = sender(from);
    return {
      url: ZOHO_URL,
      headers: {
        Authorization: key.startsWith("Zoho-enczapikey") ? key : `Zoho-enczapikey ${key}`,
        Accept: "application/json",
      },
      body: {
        from: name ? { address, name } : { address },
        to: msg.to.map((address) => ({ email_address: { address } })),
        subject: msg.subject,
        htmlbody: msg.html ?? textToHtml(msg.text),
        textbody: msg.text,
      },
    };
  }
  return {
    url: RESEND_URL,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: { from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html },
  };
}

/** Pulls a readable reason out of a provider's error body. */
function reason(status: number, body: string) {
  try {
    const j = JSON.parse(body) as {
      message?: string;
      error?: { message?: string; details?: { message?: string; inner_error?: { message?: string } }[] };
    };
    const d = j.error?.details?.[0];
    const msg = d?.inner_error?.message ?? d?.message ?? j.error?.message ?? j.message;
    if (msg) return `${msg} (${status})`;
  } catch {}
  return `HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`;
}

/** The provider's id for an accepted message (Resend `id`, Zoho `request_id` / message id). */
function messageId(body: string) {
  try {
    const j = JSON.parse(body) as { id?: string; request_id?: string; data?: { message_id?: string }[] };
    return j.id ?? j.data?.[0]?.message_id ?? j.request_id ?? null;
  } catch {
    return null;
  }
}

/** Records the attempt in the email log. Never throws. */
async function record(e: {
  kind: string;
  to: string[];
  subject: string;
  status: "sent" | "failed";
  error?: string;
  providerId?: string | null;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        kind: e.kind,
        to: e.to,
        subject: e.subject.slice(0, 300),
        status: e.status,
        error: e.error?.slice(0, 500) ?? null,
        provider: provider(),
        providerId: e.providerId ?? null,
      },
    });
  } catch (err) {
    console.error("email log failed", err);
  }
}

export async function sendEmail(msg: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  /** What it is, for the email log: "invite", "order-fulfilled", … */
  kind?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailEnabled()) return { ok: false, error: "Email isn't set up yet." };
  if (msg.to.length === 0) return { ok: false, error: "No email address to send to." };
  const kind = msg.kind ?? "other";
  const r = request(msg);
  try {
    const res = await fetch(r.url, {
      method: "POST",
      headers: { ...r.headers, "Content-Type": "application/json" },
      body: JSON.stringify(r.body),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      const why = reason(res.status, body);
      console.error("email send failed", provider(), why);
      await record({ kind, to: msg.to, subject: msg.subject, status: "failed", error: why });
      return { ok: false, error: "The email service refused the message." };
    }
    await record({ kind, to: msg.to, subject: msg.subject, status: "sent", providerId: messageId(body) });
    return { ok: true };
  } catch (e) {
    console.error("email send failed", e);
    await record({
      kind,
      to: msg.to,
      subject: msg.subject,
      status: "failed",
      error: `Couldn't reach the email service: ${e instanceof Error ? e.message : String(e)}`,
    });
    return { ok: false, error: "Couldn't reach the email service." };
  }
}

/** Minimal escaping for values dropped into email HTML. */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
