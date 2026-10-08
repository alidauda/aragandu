"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import * as actions from "./actions";
import type { ActionResult, EntryKind } from "./actions";
import type { TeamRole } from "@/lib/roles";
import type {
  Batch,
  Customer,
  Delivery,
  EggOrder,
  ErpData,
  FeedRequest,
  FeedSale,
  House,
  Ingredient,
  InvItem,
  InvMove,
  Invoice,
  LayersFeedDelivery,
  MedicationRec,
  Product,
  Run,
  VaccinationRec,
  WaterLog,
} from "./types";

/**
 * The ERP's data, loaded from Postgres by the (erp) layout on every request,
 * plus the writes. Each write is a server action that refreshes the route,
 * so the layout reloads and every derived figure on every screen moves.
 * Every write resolves with its result — forms close only on success — and
 * failures also surface as a toast.
 */
type ErpState = ErpData & {
  /** True while a write is in flight. */
  saving: boolean;
  // workflow actions
  fulfilOrder: (o: EggOrder) => Promise<ActionResult>;
  declineOrder: (o: EggOrder) => Promise<ActionResult>;
  markPaid: (v: Invoice) => Promise<ActionResult>;
  fulfilRequest: (q: FeedRequest) => Promise<ActionResult>;
  setCratePrice: (price: number) => Promise<ActionResult>;
  /** Each resolves with the invite link's path, e.g. "/invite/abc…". */
  inviteStaff: (input: { name: string; email: string; role: TeamRole }) => Promise<
    ActionResult<{ path: string }>
  >;
  inviteBuyer: (input: { customerId: number; email: string }) => Promise<
    ActionResult<{ path: string }>
  >;
  revokeInvite: (inviteId: number) => Promise<ActionResult>;
  /** True when the signed-in team member is an admin. */
  isAdmin: boolean;
  markUnpaid: (v: Invoice) => Promise<ActionResult>;
  recordPayment: (p: {
    invoiceId: number;
    amount: number;
    method: "transfer" | "cash" | "pos";
    reference: string;
  }) => Promise<ActionResult>;
  deletePayment: (paymentId: number) => Promise<ActionResult>;
  emailInvite: (path: string) => Promise<ActionResult>;
  declineRequest: (q: FeedRequest) => Promise<ActionResult>;
  setStaffRole: (userId: string, role: TeamRole) => Promise<ActionResult>;
  setUserDisabled: (userId: string, disabled: boolean) => Promise<ActionResult>;
  updateCustomer: (c: { id: number; name: string; phone: string; alloc: number }) => Promise<ActionResult>;
  updateIngredient: (i: Omit<Ingredient, "code">) => Promise<ActionResult>;
  updateProduct: (p: { id: number; name: string; price: number }) => Promise<ActionResult>;
  updateHouse: (h: House) => Promise<ActionResult>;
  updateInvItem: (i: Omit<InvItem, "sku">) => Promise<ActionResult>;
  /** Admin correction: remove a ledger entry (re-enter it if it was wrong). */
  deleteEntry: (kind: EntryKind, id: number) => Promise<ActionResult>;
  // create actions — one per model
  addProduction: (
    house: string,
    eggs: number,
    cracked: number,
    rejects?: number
  ) => Promise<ActionResult>;
  addEggMove: (type: "in" | "out", crates: number) => Promise<ActionResult>;
  logFeedUse: (house: string, kg: number) => Promise<ActionResult>;
  /** With an email, also creates the portal invite and returns its link. */
  addCustomer: (
    c: Omit<Customer, "id" | "logins"> & { email: string }
  ) => Promise<ActionResult<{ path: string | null }>>;
  addIngredient: (i: Omit<Ingredient, "id">) => Promise<ActionResult>;
  addProduct: (p: Omit<Product, "id">) => Promise<ActionResult>;
  addBatch: (b: Batch) => Promise<ActionResult>;
  recordMortality: (m: { batch: string; birds: number }) => Promise<ActionResult>;
  closeBatch: (batch: string) => Promise<ActionResult>;
  addHouse: (h: House) => Promise<ActionResult>;
  addInvItem: (i: Omit<InvItem, "id">) => Promise<ActionResult>;
  addInvMove: (m: Omit<InvMove, "id" | "date" | "health">) => Promise<ActionResult>;
  addDelivery: (d: Omit<Delivery, "id" | "date">) => Promise<ActionResult>;
  addRun: (r: Omit<Run, "id" | "date">) => Promise<ActionResult>;
  addFeedSale: (s: Omit<FeedSale, "id" | "date">) => Promise<ActionResult>;
  addFeedRequest: (q: Omit<FeedRequest, "id" | "date" | "status">) => Promise<ActionResult>;
  addLayersFeedDelivery: (d: Omit<LayersFeedDelivery, "id" | "date">) => Promise<ActionResult>;
  addWaterLog: (w: Omit<WaterLog, "id" | "date">) => Promise<ActionResult>;
  addVaccination: (v: Omit<VaccinationRec, "id" | "date">) => Promise<ActionResult>;
  addMedication: (m: Omit<MedicationRec, "id" | "date">) => Promise<ActionResult>;
  addInvoice: (v: Omit<Invoice, "id" | "date" | "paid">) => Promise<ActionResult>;
  addOrder: (o: Omit<EggOrder, "id" | "date" | "status" | "notes">) => Promise<ActionResult>;
};

const ErpContext = createContext<ErpState | null>(null);

export function ErpProvider({
  data,
  children,
}: {
  data: ErpData;
  children: React.ReactNode;
}) {
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  useFreshOnNavigation();
  usePendingWatch(data);

  const value = useMemo<ErpState>(() => {
    /** Runs a write; resolves with its result so callers can await it. */
    const run = <T,>(write: () => Promise<ActionResult<T>>) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError("");
        startTransition(async () => {
          let r: ActionResult<T>;
          try {
            r = await write();
          } catch {
            r = { ok: false, error: "Couldn't reach the server. Please try again." };
          }
          if (!r.ok) {
            if (r.signedOut) router.push("/login");
            else setError(r.error);
          }
          resolve(r);
        });
      });

    return {
      ...data,
      saving,
      fulfilOrder: (o) => run(() => actions.fulfilOrder(o.id)),
      declineOrder: (o) => run(() => actions.declineOrder(o.id)),
      markPaid: (v) => run(() => actions.markPaid(v.id)),
      fulfilRequest: (q) => run(() => actions.fulfilRequest(q.id)),
      setCratePrice: (price) => run(() => actions.setCratePrice(price)),
      inviteStaff: (input) => run(() => actions.inviteStaff(input)),
      inviteBuyer: (input) => run(() => actions.inviteBuyer(input)),
      revokeInvite: (inviteId) => run(() => actions.revokeInvite(inviteId)),
      isAdmin: data.viewer.role === "admin",
      markUnpaid: (v) => run(() => actions.markUnpaid(v.id)),
      recordPayment: (p) => run(() => actions.recordPayment(p)),
      deletePayment: (paymentId) => run(() => actions.deletePayment(paymentId)),
      emailInvite: (path) => run(() => actions.emailInvite({ path })),
      declineRequest: (q) => run(() => actions.declineRequest(q.id)),
      setStaffRole: (userId, role) => run(() => actions.setStaffRole({ userId, role })),
      setUserDisabled: (userId, disabled) =>
        run(() => actions.setUserDisabled({ userId, disabled })),
      updateCustomer: (c) => run(() => actions.updateCustomer(c)),
      updateIngredient: (i) => run(() => actions.updateIngredient(i)),
      updateProduct: (p) => run(() => actions.updateProduct(p)),
      updateHouse: (h) => run(() => actions.updateHouse(h)),
      updateInvItem: (i) => run(() => actions.updateInvItem(i)),
      deleteEntry: (kind, id) => run(() => actions.deleteEntry({ kind, id })),
      addProduction: (house, eggs, cracked, rejects = 0) =>
        run(() => actions.addProduction({ house, eggs, cracked, rejects })),
      addEggMove: (type, crates) => run(() => actions.addEggMove({ type, crates })),
      logFeedUse: (house, kg) => run(() => actions.logFeedUse({ house, kg })),
      addCustomer: (c) => run(() => actions.addCustomer(c)),
      addIngredient: (i) => run(() => actions.addIngredient(i)),
      addProduct: (p) => run(() => actions.addProduct(p)),
      addBatch: (b) => run(() => actions.addBatch(b)),
      recordMortality: (m) => run(() => actions.recordMortality(m)),
      closeBatch: (batch) => run(() => actions.closeBatch(batch)),
      addHouse: (h) => run(() => actions.addHouse(h)),
      addInvItem: (i) => run(() => actions.addInvItem(i)),
      addInvMove: (m) => run(() => actions.addInvMove(m)),
      addDelivery: (d) => run(() => actions.addDelivery(d)),
      addRun: (r) => run(() => actions.addRun(r)),
      addFeedSale: (s) => run(() => actions.addFeedSale(s)),
      addFeedRequest: (q) => run(() => actions.addFeedRequest(q)),
      addLayersFeedDelivery: (d) => run(() => actions.addLayersFeedDelivery(d)),
      addWaterLog: (w) => run(() => actions.addWaterLog(w)),
      addVaccination: (v) => run(() => actions.addVaccination(v)),
      addMedication: (m) => run(() => actions.addMedication(m)),
      addInvoice: (v) => run(() => actions.addInvoice(v)),
      addOrder: (o) => run(() => actions.addOrder(o)),
    };
  }, [data, saving, router]);

  return (
    <ErpContext.Provider value={value}>
      {children}
      {error ? (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-[#e2c9c3] bg-[#fbe9e5] px-4 py-3 text-[13px] text-[#8a2f22] shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss"
            className="font-bold text-[#b3402f]"
          >
            ×
          </button>
        </div>
      ) : null}
    </ErpContext.Provider>
  );
}

/**
 * The layout is shared, so client navigation doesn't re-run it. Reload the
 * ledgers on navigation and when the tab comes back into view — at most
 * every 30s, since each reload reads every ledger — so orders placed in the
 * portal show up without a manual reload.
 */
const REFRESH_EVERY_MS = 30_000;

function useFreshOnNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef(0);

  useEffect(() => {
    const maybeRefresh = () => {
      if (Date.now() - last.current < REFRESH_EVERY_MS) return;
      last.current = Date.now();
      router.refresh();
    };
    // The first render already has fresh data.
    if (last.current === 0) last.current = Date.now();
    else maybeRefresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname, router]);
}

/**
 * Watches for new work every minute while the tab is visible: when the
 * pending counts move, reload the ledgers; when a new egg order arrives,
 * raise a browser notification (if allowed) and count it in the tab title.
 */
const WATCH_EVERY_MS = 60_000;

function usePendingWatch(data: ErpData) {
  const router = useRouter();
  const pendingOrders = data.orders.filter((o) => o.status === "pending").length;
  const pendingReqs = data.reqs.filter((q) => q.status === "pending").length;
  const seen = useRef({ orders: pendingOrders, requests: pendingReqs });
  seen.current = { orders: pendingOrders, requests: pendingReqs };

  // Each page sets its own title on navigation, so re-apply the count
  // whenever the <title> changes.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, "");
      const want = pendingOrders > 0 ? `(${pendingOrders}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    // Watch the whole <head>: the title element itself may be replaced.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [pendingOrders]);

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/erp/pending", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const now = (await res.json()) as { orders: number; requests: number };
      const before = seen.current;
      if (now.orders === before.orders && now.requests === before.requests) return;
      if (
        now.orders > before.orders &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const n = now.orders - before.orders;
        new Notification("New egg order", {
          body: `${n} new order${n > 1 ? "s" : ""} waiting on Egg orders.`,
        });
      }
      router.refresh();
    };
    const timer = window.setInterval(() => void check(), WATCH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [router]);
}

export function useErp(): ErpState {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used inside ErpProvider");
  return ctx;
}
