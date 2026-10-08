"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronDown, KeyRound, LogOut, Menu, Search } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { changePassword } from "@/lib/change-password";
import { longDate } from "@/lib/dates";
import { useErp } from "@/lib/erp/store";
import { roleLabel } from "@/lib/roles";
import { Drawer, FormError, TextField } from "@/components/erp/Drawer";
import { ALL_PAGES } from "@/components/erp/Sidebar";

type Hit = { label: string; hint: string; href: string; newTab?: boolean };

/** Jump to a page, buyer, invoice or batch by typing a few letters. */
function SearchBox() {
  const S = useErp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses the search from anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const has = (s: string) => s.toLowerCase().includes(term);
    const invNo = (id: number) => `INV-${String(id).padStart(5, "0")}`;
    return [
      ...ALL_PAGES.filter((p) => has(p.label)).map((p) => ({
        label: p.label,
        hint: p.section,
        href: p.href,
      })),
      ...S.customers
        .filter((c) => has(c.name) || has(c.phone))
        .map((c) => ({ label: c.name, hint: "Buyer", href: "/customers" })),
      ...S.invoices
        .filter((v) => has(invNo(v.id)) || has(v.name))
        .slice(0, 6)
        .map((v) => ({
          label: `${invNo(v.id)} · ${v.name}`,
          hint: "Invoice",
          href: `/invoices/${v.id}`,
          newTab: true,
        })),
      ...S.batches
        .filter((b) => has(b.batch) || has(b.breed))
        .map((b) => ({ label: b.batch, hint: `Batch · ${b.breed}`, href: "/layers/batches" })),
    ].slice(0, 9);
  }, [q, S.customers, S.invoices, S.batches]);

  const go = (h: Hit) => {
    setQ("");
    setOpen(false);
    input.current?.blur();
    if (h.newTab) window.open(h.href, "_blank");
    else router.push(h.href);
  };

  return (
    <div className="relative w-full max-w-[420px]">
      <Search
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b958d]"
      />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && hits[active]) go(hits[active]);
          else if (e.key === "Escape") input.current?.blur();
        }}
        placeholder="Search buyers, invoices, batches, pages…"
        aria-label="Search"
        className="w-full rounded-xl border border-[#e7ebe6] bg-[#f6f8f5] py-2.5 pl-10 pr-10 text-[14px] text-[#14231a] outline-none transition-colors placeholder:text-[#8b958d] focus:border-[#2f8f46] focus:bg-white"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#e7ebe6] bg-white px-1.5 text-[11px] text-[#8b958d] sm:block">
        /
      </kbd>
      {open && q.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[#e7ebe6] bg-white py-1.5 shadow-[0_16px_40px_-16px_rgba(16,58,34,0.3)]">
          {hits.length === 0 ? (
            <div className="px-4 py-3 text-[13.5px] text-[#8b958d]">Nothing matches “{q.trim()}”.</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.href}-${h.label}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[14px] ${
                  i === active ? "bg-[#f4f6f3]" : ""
                }`}
              >
                <span className="truncate font-medium text-[#14231a]">{h.label}</span>
                <span className="shrink-0 text-[12.5px] text-[#8b958d]">{h.hint}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Avatar, name and the account menu (password, sign out). */
function UserMenu() {
  const { viewer } = useErp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const initials = viewer.name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const savePassword = async () => {
    if (pwDone) return setPwOpen(false);
    setPwError("");
    const err = await changePassword(pw.current, pw.next, pw.confirm);
    if (err) return setPwError(err);
    setPw({ current: "", next: "", confirm: "" });
    setPwDone(true);
  };

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-xl py-1 pl-1 pr-2 text-left hover:bg-[#f4f6f3]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eaf5ec] text-[13px] font-bold text-[#1f6e35]">
          {initials}
        </span>
        <span className="hidden min-w-0 leading-tight md:block">
          <span className="block truncate text-[14.5px] font-semibold text-[#14231a]">
            {viewer.name}
          </span>
          <span className="block truncate text-[12.5px] text-[#8b958d]">
            {roleLabel(viewer.role)} · {viewer.email}
          </span>
        </span>
        <ChevronDown size={16} className="hidden text-[#8b958d] md:block" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-[#e7ebe6] bg-white py-1.5 shadow-[0_16px_40px_-16px_rgba(16,58,34,0.3)]">
          <button
            onClick={() => {
              setOpen(false);
              setPwError("");
              setPwDone(false);
              setPwOpen(true);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-[#14231a] hover:bg-[#f4f6f3]"
          >
            <KeyRound size={16} className="text-[#647067]" /> Change password
          </button>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-[#14231a] hover:bg-[#f4f6f3]"
          >
            <LogOut size={16} className="text-[#647067]" /> Sign out
          </button>
        </div>
      ) : null}
      <Drawer
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        sub="Your other devices are signed out"
        onSubmit={() => void savePassword()}
        submitLabel={pwDone ? "Done" : "Change password"}
      >
        {pwDone ? (
          <div className="text-[14px] text-[#23753a]">Password changed.</div>
        ) : (
          <>
            <TextField
              label="Current password"
              type="password"
              value={pw.current}
              onChange={(v) => setPw({ ...pw, current: v })}
            />
            <TextField
              label="New password (8+ characters)"
              type="password"
              value={pw.next}
              onChange={(v) => setPw({ ...pw, next: v })}
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={pw.confirm}
              onChange={(v) => setPw({ ...pw, confirm: v })}
            />
            <FormError message={pwError} />
          </>
        )}
      </Drawer>
    </div>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const S = useErp();
  const pending = S.orders.filter((o) => o.status === "pending").length;

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-[#e7ebe6] bg-white/95 px-4 backdrop-blur md:gap-4 md:px-8">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#14231a] hover:bg-[#f4f6f3] lg:hidden"
      >
        <Menu size={21} />
      </button>
      <SearchBox />
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-[#e7ebe6] px-3 py-2 text-[13.5px] font-medium text-[#4c5a51] xl:flex">
          <CalendarDays size={16} className="text-[#647067]" />
          {longDate(S.today)}
        </div>
        <Link
          href="/layers/orders"
          aria-label={pending ? `${pending} orders waiting` : "Egg orders"}
          title={pending ? `${pending} orders waiting` : "No orders waiting"}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-[#e7ebe6] text-[#14231a] hover:bg-[#f4f6f3]"
        >
          <Bell size={18} />
          {pending > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-[#2f8f46] px-1 text-center text-[10.5px] font-bold leading-4 text-white">
              {pending}
            </span>
          ) : null}
        </Link>
        <span className="hidden h-8 w-px bg-[#e7ebe6] md:block" />
        <UserMenu />
      </div>
    </header>
  );
}
