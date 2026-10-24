import "server-only";

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

export async function sendEmail(msg: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailEnabled()) return { ok: false, error: "Email isn't set up yet." };
  if (msg.to.length === 0) return { ok: false, error: "No email address to send to." };
  const r = request(msg);
  try {
    const res = await fetch(r.url, {
      method: "POST",
      headers: { ...r.headers, "Content-Type": "application/json" },
      body: JSON.stringify(r.body),
    });
    if (!res.ok) {
      console.error("email send failed", provider(), res.status, await res.text().catch(() => ""));
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
