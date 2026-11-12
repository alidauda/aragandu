import * as Crypto from "expo-crypto";
import { useSyncExternalStore } from "react";

import type { ErpData } from "@farm/erp/types";

import { api, type User } from "./api";
import { kept, token as tokenStore } from "./storage";

/**
 * The app's one store: who's signed in, the farm's figures as last loaded,
 * and the entries made on this phone that haven't reached the website yet.
 *
 * Every entry is first kept on the phone, then sent. With no signal it waits
 * and goes later, in the order it was made; each carries a key so the website
 * saves it once however many times it's sent.
 */

/** The entries the app can make (the website's actions of the same names). */
export type EntryName = "addDailyRecords" | "addBroilerDaily" | "addEggMove" | "addInvoice";

export type Entry = {
  key: string;
  /** Whose entry it is: only they send it. */
  owner: string;
  name: EntryName;
  input: unknown;
  /** For the waiting list: what it is and what's in it. */
  title: string;
  detail: string;
  /** When it was made on the phone. */
  at: number;
  /** waiting: not sent yet. refused: the website said no. unsure: sent, but the answer never came. */
  state: "waiting" | "refused" | "unsure";
  error?: string;
};

type State = {
  /** False until what's kept on the phone has been read. */
  ready: boolean;
  token: string | null;
  user: User | null;
  data: ErpData | null;
  /** When `data` was loaded from the website. */
  loadedAt: number | null;
  outbox: Entry[];
  /** Whether the last request reached the website. */
  online: boolean;
  syncing: boolean;
  /** The sign-in ran out; entries wait until they sign in again. */
  expired: boolean;
};

let state: State = {
  ready: false,
  token: null,
  user: null,
  data: null,
  loadedAt: null,
  outbox: [],
  online: true,
  syncing: false,
  expired: false,
};

const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useFarm = () => useSyncExternalStore(subscribe, () => state, () => state);

const K = { user: "argandu.user", data: "argandu.data", outbox: "argandu.outbox" };

function setOutbox(outbox: Entry[]) {
  kept.set(K.outbox, outbox);
  set({ outbox });
}

/** This person's entries still on the phone. */
export const mine = (s: Pick<State, "outbox" | "user">) => s.outbox.filter((e) => e.owner === s.user?.id);

/** Reads what the phone kept, then catches up with the website. */
export async function start() {
  if (state.ready) return;
  const token = await tokenStore.get().catch(() => null);
  const saved = kept.get<{ data: ErpData; loadedAt: number } | null>(K.data, null);
  set({
    ready: true,
    token,
    user: kept.get<User | null>(K.user, null),
    data: token ? (saved?.data ?? null) : null,
    loadedAt: token ? (saved?.loadedAt ?? null) : null,
    outbox: kept.get<Entry[]>(K.outbox, []),
  });
  if (token) void sync();
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await api.signIn(email, password);
  if (r.kind === "offline") return { ok: false, error: "Can't reach the farm's website. Check your connection and try again." };
  if (r.kind !== "ok") return { ok: false, error: r.kind === "refused" ? r.error : "Wrong email or password." };
  await tokenStore.set(r.body.token);
  kept.set(K.user, r.body.user);
  // Another person's figures never show, even for a moment.
  kept.remove(K.data);
  set({ token: r.body.token, user: r.body.user, data: null, loadedAt: null, expired: false, online: true });
  void sync();
  return { ok: true };
}

/** Entries not yet sent stay on the phone for when they sign in again. */
export async function signOut() {
  const t = state.token;
  await tokenStore.clear().catch(() => null);
  kept.remove(K.data);
  set({ token: null, data: null, loadedAt: null, expired: false });
  if (t) void api.signOut(t);
}

/** The website no longer accepts the token: back to sign-in, keeping their entries. */
async function expire() {
  await tokenStore.clear().catch(() => null);
  kept.remove(K.data);
  set({ token: null, data: null, loadedAt: null, expired: true });
}

/** One run at a time: a call made while it's running joins that run. */
function single(run: () => Promise<void>) {
  let going: Promise<void> | null = null;
  // Started a beat later, so `going` is set before the run can finish and clear it.
  return () => (going ??= Promise.resolve().then(run).finally(() => (going = null)));
}

/** Sends waiting entries, oldest first. Stops at the first that can't go yet. */
const flush = single(async () => {
  for (;;) {
    const next = mine(state).find((e) => e.state === "waiting");
    const t = state.token;
    if (!next || !t) return;
    const r = await api.act(t, next);
    if (r.kind === "ok") {
      setOutbox(state.outbox.filter((e) => e.key !== next.key));
      set({ online: true });
    } else if (r.kind === "offline") {
      return set({ online: false });
    } else if (r.kind === "signedOut") {
      return await expire();
    } else if (r.busy) {
      return;
    } else {
      setOutbox(state.outbox.map((e) => (e.key === next.key ? { ...e, state: r.unsure ? "unsure" : "refused", error: r.error } : e)));
      set({ online: true });
    }
  }
});

/** Loads the farm's figures afresh. With no signal the last ones stay. */
const pull = single(async () => {
  const t = state.token;
  if (!t) return;
  const r = await api.data(t);
  if (r.kind === "ok") {
    const loadedAt = Date.now();
    kept.set(K.data, { data: r.body.data, loadedAt });
    // Their name may have changed on the website.
    const user = { id: r.body.data.viewer.id, name: r.body.data.viewer.name, email: r.body.data.viewer.email };
    kept.set(K.user, user);
    set({ data: r.body.data, loadedAt, online: true, user });
  } else if (r.kind === "signedOut") {
    await expire();
  } else if (r.kind === "offline") {
    set({ online: false });
  }
});

/** Sends what's waiting, then reloads the figures. */
export async function sync() {
  if (!state.token) return;
  set({ syncing: true });
  try {
    await flush();
    await pull();
  } finally {
    set({ syncing: false });
  }
}

export type Sent =
  /** On the website. */
  | { kind: "sent" }
  /** Kept on the phone; it goes when it can. */
  | { kind: "kept"; why: "offline" | "signedOut" | "unsure" }
  /** The website said no, and why. Nothing was saved. */
  | { kind: "refused"; error: string };

/** Makes an entry: kept on the phone first, then sent at once if there's signal. */
export async function submit(name: EntryName, input: unknown, label: { title: string; detail: string }): Promise<Sent> {
  const owner = state.user?.id;
  if (!owner) return { kind: "refused", error: "Sign in first." };
  const entry: Entry = { key: Crypto.randomUUID(), owner, name, input, ...label, at: Date.now(), state: "waiting" };
  const outbox = [...state.outbox, entry];
  if (!kept.set(K.outbox, outbox)) return { kind: "refused", error: "This phone's storage is full, so the entry couldn't be kept. Free some space and try again." };
  set({ outbox });

  await flush();
  const left = state.outbox.find((e) => e.key === entry.key);
  if (!left) {
    void pull();
    return { kind: "sent" };
  }
  if (left.state === "refused") {
    // They're looking at the form: show why there, and let them put it right.
    setOutbox(state.outbox.filter((e) => e.key !== entry.key));
    return { kind: "refused", error: left.error ?? "That didn't go through." };
  }
  return { kind: "kept", why: left.state === "unsure" ? "unsure" : state.expired ? "signedOut" : "offline" };
}

/** Removes an entry from the phone without sending it. */
export const discard = (key: string) => setOutbox(state.outbox.filter((e) => e.key !== key));

/** Puts a refused entry back in line (after the cause was put right on the website, say). */
export function resend(key: string) {
  setOutbox(state.outbox.map((e) => (e.key === key && e.state === "refused" ? { ...e, state: "waiting", error: undefined } : e)));
  void sync();
}

/** The phone says it has lost its connection: no need to wait for a request to fail. */
export function noSignal() {
  if (state.online) set({ online: false });
}

/** How old the figures may get while the app is open before it reloads them. */
const STALE_MS = 5 * 60 * 1000;

/** Called now and then while the app is open: sends what's waiting, and reloads figures that have gone stale. */
export function tick() {
  if (!state.token || state.syncing) return;
  const waiting = mine(state).some((e) => e.state === "waiting");
  if (waiting || !state.loadedAt || Date.now() - state.loadedAt > STALE_MS) void sync();
}
