import { useState } from "react";

import { submit, type EntryName } from "@/farm/store";

type Message = { tone: "good" | "warn" | "bad"; text: string };

const KEPT = {
  offline: "No signal. Kept on this phone — it will be sent as soon as there is signal.",
  signedOut: "Kept on this phone. Sign in again to send it.",
  unsure: "The signal dropped while sending. Open Waiting to send to see what to do.",
} as const;

/** A form's save: sends the entry and says how it went. The form is cleared only once the entry is safe. */
export function useSend() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const send = async (name: EntryName, input: unknown, label: { title: string; detail: string }, clear: () => void) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const r = await submit(name, input, label);
    setBusy(false);
    if (r.kind === "refused") return setMessage({ tone: "bad", text: r.error });
    clear();
    setMessage(r.kind === "sent" ? { tone: "good", text: `${label.title} saved ✓` } : { tone: "warn", text: KEPT[r.why] });
  };

  return { busy, message, send, problem: (text: string) => setMessage({ tone: "bad", text }), clearMessage: () => setMessage(null) };
}
