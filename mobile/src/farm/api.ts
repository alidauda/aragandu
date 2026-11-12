import { fetch } from "expo/fetch";

import type { ErpData } from "@farm/erp/types";

import { API_URL } from "./config";

/**
 * How a request to the website ended. "offline" covers no signal and a server
 * that can't answer right now: either way, try again later.
 */
export type Reply<T> =
  | { kind: "ok"; body: T }
  | { kind: "offline" }
  | { kind: "signedOut" }
  /** `busy`: an earlier send of the same entry is still saving. `unsure`: it can't be confirmed either way. */
  | { kind: "refused"; error: string; busy?: boolean; unsure?: boolean };

const TIMEOUT_MS = 25_000;

async function call<T>(path: string, init: { method?: string; token?: string | null; body?: unknown } = {}): Promise<Reply<T>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/mobile/${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: stop.signal,
    });
    const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string; signedOut?: boolean; retry?: boolean; unsure?: boolean }) | null;
    if (res.ok && body) return { kind: "ok", body };
    if (res.status === 401 && body?.signedOut) return { kind: "signedOut" };
    if (res.status >= 500 || !body) return { kind: "offline" };
    return { kind: "refused", error: body.error ?? "That didn't go through.", busy: body.retry, unsure: body.unsure };
  } catch {
    return { kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

/** A receipt's photo and details. Sent with the phone's own fetch, which knows how to attach a photo from the gallery or camera. */
async function upload(token: string, form: FormData): Promise<Reply<object>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 4 * TIMEOUT_MS);
  try {
    const res = await globalThis.fetch(`${API_URL}/api/mobile/proofs`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: stop.signal });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; signedOut?: boolean } | null;
    if (res.ok && body?.ok) return { kind: "ok", body };
    if (res.status === 401 && body?.signedOut) return { kind: "signedOut" };
    if (res.status >= 500 || !body) return { kind: "offline" };
    return { kind: "refused", error: body.error ?? "That didn't go through." };
  } catch {
    return { kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

export type User = { id: string; name: string; email: string };

export const api = {
  signIn: (email: string, password: string) =>
    call<{ token: string; user: User }>("sign-in", { method: "POST", body: { email, password } }),
  signOut: (token: string) => call<object>("sign-out", { method: "POST", token }),
  data: (token: string) => call<{ data: ErpData }>("data", { token }),
  proof: upload,
  /** One entry. `key` names it, so sending it again saves nothing new. */
  act: (token: string, entry: { key: string; name: string; input: unknown }) =>
    call<object>("act", { method: "POST", token, body: { key: entry.key, name: entry.name, input: entry.input } }),
};
