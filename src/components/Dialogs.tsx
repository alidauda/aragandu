"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * The app's own confirm and prompt: `await confirmDialog({…})` is true if
 * they agreed, `await promptDialog({…})` is what they typed, or null. One
 * <DialogHost /> in the root layout shows them, above any drawer.
 */

type Base = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, and Enter lands on Cancel. */
  danger?: boolean;
};
type Ask =
  | (Base & { kind: "confirm"; done: (ok: boolean) => void })
  | (Base & {
      kind: "prompt";
      label: string;
      placeholder?: string;
      minLength: number;
      done: (text: string | null) => void;
    });

let current: Ask | null = null;
const listeners = new Set<() => void>();
const show = (ask: Ask | null) => {
  current = ask;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function confirmDialog(o: Base) {
  return new Promise<boolean>((resolve) => show({ ...o, kind: "confirm", done: resolve }));
}

export function promptDialog(o: Base & { label: string; placeholder?: string; minLength?: number }) {
  return new Promise<string | null>((resolve) =>
    show({ minLength: 3, ...o, kind: "prompt", done: resolve })
  );
}

export function DialogHost() {
  const ask = useSyncExternalStore(subscribe, () => current, () => null);
  if (!ask) return null;
  // Remounts for each question, so the text box starts empty.
  return createPortal(<Dialog key={ask.title + (ask.body ?? "")} ask={ask} />, document.body);
}

function Dialog({ ask }: { ask: Ask }) {
  const [text, setText] = useState("");
  const safe = useRef<HTMLButtonElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const prompt = ask.kind === "prompt";
  const ready = !prompt || text.trim().length >= ask.minLength;

  const cancel = () => {
    show(null);
    if (ask.kind === "prompt") ask.done(null);
    else ask.done(false);
  };
  const accept = () => {
    if (!ready) return;
    show(null);
    if (ask.kind === "prompt") ask.done(text.trim());
    else ask.done(true);
  };

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (prompt) input.current?.focus();
    else (ask.danger ? safe : go).current?.focus();
    // Esc answers this dialog only, not the drawer underneath; Tab stays inside.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cancel();
      }
      if (e.key === "Tab") {
        const box = safe.current?.closest("[role=alertdialog]");
        const items = box ? [...box.querySelectorAll<HTMLElement>("textarea, button:not(:disabled)")] : [];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
    // Set up once for this question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
      <button aria-label="Cancel" tabIndex={-1} onClick={cancel} className="absolute inset-0 cursor-default bg-[#0d1d1d]/40" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={ask.body ? "dialog-body" : undefined}
        className="relative w-full max-w-[420px] rounded-2xl bg-white px-6 py-5 shadow-[0_24px_60px_-20px_rgba(5,70,71,0.45)]"
      >
        <h2 id="dialog-title" className="font-display text-[19px] font-bold text-[#0d1d1d]">
          {ask.title}
        </h2>
        {ask.body ? (
          <p id="dialog-body" className="mt-1.5 whitespace-pre-line text-[14px] text-[#465657]">
            {ask.body}
          </p>
        ) : null}
        {ask.kind === "prompt" ? (
          <label className="mt-3.5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#465657]">{ask.label}</span>
            <textarea
              ref={input}
              rows={2}
              value={text}
              placeholder={ask.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  accept();
                }
              }}
              className="w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#055a5b] focus:ring-2 focus:ring-[#055a5b]/15"
            />
          </label>
        ) : null}
        <div className="mt-5 flex gap-2.5">
          <button
            ref={safe}
            type="button"
            onClick={cancel}
            className="font-sub flex-1 rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] text-[#465657] outline-none focus-visible:ring-2 focus-visible:ring-[#055a5b]/40"
          >
            {ask.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={go}
            type="button"
            disabled={!ready}
            onClick={accept}
            className={`font-sub flex-1 rounded-[10px] px-4 py-2.5 text-[14px] text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 ${
              ask.danger ? "bg-[#b3473a] focus-visible:ring-[#b3473a]/50" : "bg-[#055a5b] focus-visible:ring-[#055a5b]/50"
            }`}
          >
            {ask.confirmLabel ?? "Yes"}
          </button>
        </div>
      </div>
    </div>
  );
}
