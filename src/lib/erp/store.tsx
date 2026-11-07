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
import type { ActionResult, BulkKind, EntryKind } from "./actions";
import { areaOf, canAct, canSee, isFarmWide, type Area, type Grants, type TeamLevel } from "@/lib/access";
import type { TeamRole } from "@/lib/roles";
import type {
  Batch,
  Customer,
  EggOrder,
  ErpData,
  FeedRequest,
  House,
  Ingredient,
  Invoice,
  Product,
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
  /** Fulfil all of an order, or `crates` of it. */
  fulfilOrder: (o: EggOrder, crates?: number, withBalance?: boolean) => Promise<ActionResult>;
  declineOrder: (o: EggOrder) => Promise<ActionResult>;
  markPaid: (v: Invoice) => Promise<ActionResult>;
  fulfilRequest: (q: FeedRequest) => Promise<ActionResult>;
  setCratePrice: (price: number) => Promise<ActionResult>;
  setFeedBagKg: (kg: number) => Promise<ActionResult>;
  setPaymentSettings: (s: In<typeof actions.setPaymentSettings>) => Promise<ActionResult>;
  rejectProof: (id: number, reason: string) => Promise<ActionResult>;
  addAssets: (a: In<typeof actions.addAssets>) => Promise<ActionResult>;
  updateAsset: (a: In<typeof actions.updateAsset>) => Promise<ActionResult>;
  updateAssets: (a: In<typeof actions.updateAssets>) => Promise<ActionResult>;
  importAssets: (a: In<typeof actions.importAssets>) => Promise<
    ActionResult<{ added: number; skipped: string[]; duplicates: number }>
  >;
  disposeAsset: (id: number, reason: string) => Promise<ActionResult>;
  restoreAsset: (id: number) => Promise<ActionResult>;
  deleteAsset: (id: number) => Promise<ActionResult>;
  /** Each resolves with the invite link's path, e.g. "/invite/abc…". */
  inviteStaff: (input: In<typeof actions.inviteStaff>) => Promise<
    ActionResult<{ path: string; emailed: boolean }>
  >;
  inviteBuyer: (input: { customerId: number; email: string }) => Promise<
    ActionResult<{ path: string; emailed: boolean }>
  >;
  revokeInvite: (inviteId: number) => Promise<ActionResult>;
  /** Admin of the part of the ERP this page belongs to. */
  isAdmin: boolean;
  /** All their roles (see src/lib/access.ts). */
  grants: Grants;
  /** The owner or a farm-wide member. */
  farmWide: boolean;
  /** Whether they may open a part of the ERP (menus and page guards). */
  can: (area: Area) => boolean;
  /** Whether they may act there at a level ("staff" by default). */
  canDo: (area: Area, level?: TeamLevel) => boolean;
  markUnpaid: (v: Invoice) => Promise<ActionResult>;
  recordPayment: (p: In<typeof actions.recordPayment>) => Promise<ActionResult>;
  deletePayment: (paymentId: number) => Promise<ActionResult>;
  emailInvite: (path: string) => Promise<ActionResult>;
  declineRequest: (q: FeedRequest) => Promise<ActionResult>;
  setUserDisabled: (userId: string, disabled: boolean) => Promise<ActionResult>;
  /** A one-hour link to choose a new password, to send by hand. */
  passwordResetLink: (userId: string) => Promise<ActionResult<{ url: string; email: string }>>;
  setUserPassword: (userId: string, password: string) => Promise<ActionResult>;
  setUserGrants: (p: In<typeof actions.setUserGrants>) => Promise<ActionResult>;
  removeCustomer: (customerId: number) => Promise<ActionResult<{ deleted: boolean }>>;
  restoreCustomer: (customerId: number) => Promise<ActionResult>;
  updateCustomer: (c: In<typeof actions.updateCustomer>) => Promise<ActionResult>;
  updateIngredient: (i: Omit<Ingredient, "code">) => Promise<ActionResult>;
  updateProduct: (p: { id: number; name: string; price: number }) => Promise<ActionResult>;
  updateHouse: (h: In<typeof actions.updateHouse>) => Promise<ActionResult>;
  updateInvItem: (i: In<typeof actions.updateInvItem>) => Promise<ActionResult>;
  deleteInvItem: (id: number) => Promise<ActionResult>;
  /** Admin correction: remove a ledger entry (re-enter it if it was wrong). */
  deleteEntry: (kind: EntryKind, id: number) => Promise<ActionResult>;
  deleteEntries: (kind: BulkKind, ids: number[]) => Promise<ActionResult>;
  addManure: (m: In<typeof actions.addManure>) => Promise<ActionResult>;
  addFinanceEntry: (e: In<typeof actions.addFinanceEntry>) => Promise<ActionResult>;
  setFinanceMonth: (m: In<typeof actions.setFinanceMonth>) => Promise<ActionResult>;
  setBatchCosts: (c: In<typeof actions.setBatchCosts>) => Promise<ActionResult>;
  setBroilerBatchCosts: (c: In<typeof actions.setBroilerBatchCosts>) => Promise<ActionResult>;
  addBroilerHouse: (x: In<typeof actions.addBroilerHouse>) => Promise<ActionResult>;
  updateBroilerHouse: (x: In<typeof actions.updateBroilerHouse>) => Promise<ActionResult>;
  deleteBroilerHouse: (x: In<typeof actions.deleteBroilerHouse>) => Promise<ActionResult>;
  addBroilerBatch: (x: In<typeof actions.addBroilerBatch>) => Promise<ActionResult>;
  updateBroilerBatch: (x: In<typeof actions.updateBroilerBatch>) => Promise<ActionResult>;
  closeBroilerBatch: (x: In<typeof actions.closeBroilerBatch>) => Promise<ActionResult>;
  deleteBroilerBatch: (x: In<typeof actions.deleteBroilerBatch>) => Promise<ActionResult>;
  addBroilerDaily: (x: In<typeof actions.addBroilerDaily>) => Promise<ActionResult>;
  addBroilerWeighing: (x: In<typeof actions.addBroilerWeighing>) => Promise<ActionResult>;
  addBroilerFeedDelivery: (x: In<typeof actions.addBroilerFeedDelivery>) => Promise<ActionResult>;
  addBroilerHealth: (x: In<typeof actions.addBroilerHealth>) => Promise<ActionResult>;
  sellBroilers: (x: In<typeof actions.sellBroilers>) => Promise<ActionResult>;
  dispatchToLayers: (x: In<typeof actions.dispatchToLayers>) => Promise<ActionResult>;
  addAnimal: (x: In<typeof actions.addAnimal>) => Promise<ActionResult>;
  recordBirth: (x: In<typeof actions.recordBirth>) => Promise<ActionResult>;
  updateAnimal: (x: In<typeof actions.updateAnimal>) => Promise<ActionResult>;
  animalLeft: (x: In<typeof actions.animalLeft>) => Promise<ActionResult>;
  addAnimalWeight: (x: In<typeof actions.addAnimalWeight>) => Promise<ActionResult>;
  addAnimalHealth: (x: In<typeof actions.addAnimalHealth>) => Promise<ActionResult>;
  addRuminantFeed: (x: In<typeof actions.addRuminantFeed>) => Promise<ActionResult>;
  sellAnimals: (x: In<typeof actions.sellAnimals>) => Promise<ActionResult>;
  processBroilers: (x: In<typeof actions.processBroilers>) => Promise<ActionResult>;
  sellProcessed: (x: In<typeof actions.sellProcessed>) => Promise<ActionResult>;
  addBroilerExpense: (x: In<typeof actions.addBroilerExpense>) => Promise<ActionResult>;
  // create actions — one per model
  addProduction: (
    house: string,
    eggs: number,
    cracked: number,
    rejects?: number,
    date?: string,
    batch?: string
  ) => Promise<ActionResult>;
  addEggMove: (type: "in" | "out", crates: number, reason?: string, date?: string) => Promise<ActionResult>;
  reviewEggMove: (id: number, approve: boolean) => Promise<ActionResult>;
  logFeedUse: (house: string, kg: number, product: number, date?: string, batch?: string) => Promise<ActionResult>;
  /** With an email, also creates the portal invite and returns its link. */
  addCustomer: (
    c: In<typeof actions.addCustomer>
  ) => Promise<ActionResult<{ path: string | null; emailed?: boolean }>>;
  addIngredient: (i: Omit<Ingredient, "id">) => Promise<ActionResult>;
  addProduct: (p: Omit<Product, "id">) => Promise<ActionResult>;
  addBatch: (b: In<typeof actions.addBatch>) => Promise<ActionResult>;
  recordMortality: (m: In<typeof actions.recordMortality>) => Promise<ActionResult>;
  setInLay: (batch: string, date: string) => Promise<ActionResult>;
  placeBatch: (p: In<typeof actions.placeBatch>) => Promise<ActionResult>;
  updateBatch: (b: In<typeof actions.updateBatch>) => Promise<ActionResult>;
  deleteBatch: (batch: string) => Promise<ActionResult>;
  deleteHouse: (code: string) => Promise<ActionResult>;
  addDailyRecords: (d: In<typeof actions.addDailyRecords>) => Promise<ActionResult>;
  closeBatch: (batch: string) => Promise<ActionResult>;
  addHouse: (h: House) => Promise<ActionResult>;
  addInvItem: (i: In<typeof actions.addInvItem>) => Promise<ActionResult>;
  addInvMove: (m: In<typeof actions.addInvMove>) => Promise<ActionResult>;
  addDelivery: (d: In<typeof actions.addDelivery>) => Promise<ActionResult>;
  addRun: (r: In<typeof actions.addRun>) => Promise<ActionResult>;
  addFeedSale: (s: In<typeof actions.addFeedSale>) => Promise<ActionResult>;
  addFeedRequest: (q: Omit<FeedRequest, "id" | "date" | "status" | "by" | "createdAt">) => Promise<ActionResult>;
  addLayersFeedDelivery: (d: In<typeof actions.addLayersFeedDelivery>) => Promise<ActionResult>;
  addWaterLog: (w: In<typeof actions.addWaterLog>) => Promise<ActionResult>;
  addVaccination: (v: In<typeof actions.addVaccination>) => Promise<ActionResult>;
  giveVaccination: (id: number, qtyUsed: number, date?: string) => Promise<ActionResult>;
  addMedication: (m: In<typeof actions.addMedication>) => Promise<ActionResult>;
  addInvoice: (v: In<typeof actions.addInvoice>) => Promise<ActionResult>;
  recordAdvance: (p: In<typeof actions.recordAdvance>) => Promise<ActionResult>;
  markOrderPaid: (p: In<typeof actions.markOrderPaid>) => Promise<ActionResult>;
  undoOrderPayment: (orderId: number) => Promise<ActionResult>;
  clearEggData: (upTo: string, confirm: string) => Promise<ActionResult>;
  refundCredit: (p: In<typeof actions.refundCredit>) => Promise<ActionResult>;
  addOrder: (o: Omit<EggOrder, "id" | "date" | "status" | "notes" | "paidSoFar">) => Promise<ActionResult>;
};

/** An action's input type. */
type In<F> = F extends (input: infer I) => unknown ? I : never;

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
  const pathname = usePathname();
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
      fulfilOrder: (o, crates, withBalance) => run(() => actions.fulfilOrder({ orderId: o.id, crates, withBalance })),
      declineOrder: (o) => run(() => actions.declineOrder(o.id)),
      markPaid: (v) => run(() => actions.markPaid(v.id)),
      fulfilRequest: (q) => run(() => actions.fulfilRequest(q.id)),
      setCratePrice: (price) => run(() => actions.setCratePrice(price)),
      setFeedBagKg: (kg) => run(() => actions.setFeedBagKg({ kg })),
      setPaymentSettings: (s) => run(() => actions.setPaymentSettings(s)),
      rejectProof: (id, reason) => run(() => actions.rejectProof({ id, reason })),
      addAssets: (a) => run(() => actions.addAssets(a)),
      updateAsset: (a) => run(() => actions.updateAsset(a)),
      updateAssets: (a) => run(() => actions.updateAssets(a)),
      importAssets: (a) => run(() => actions.importAssets(a)),
      disposeAsset: (id, reason) => run(() => actions.disposeAsset({ id, reason })),
      restoreAsset: (id) => run(() => actions.restoreAsset({ id })),
      deleteAsset: (id) => run(() => actions.deleteAsset({ id })),
      inviteStaff: (input) => run(() => actions.inviteStaff(input)),
      inviteBuyer: (input) => run(() => actions.inviteBuyer(input)),
      revokeInvite: (inviteId) => run(() => actions.revokeInvite(inviteId)),
      isAdmin: canAct(data.viewer.grants, areaOf(pathname), "admin"),
      grants: data.viewer.grants,
      farmWide: isFarmWide(data.viewer.grants),
      can: (area) => canSee(data.viewer.grants, area),
      canDo: (area, level = "staff") => canAct(data.viewer.grants, area, level),
      markUnpaid: (v) => run(() => actions.markUnpaid(v.id)),
      recordPayment: (p) => run(() => actions.recordPayment(p)),
      deletePayment: (paymentId) => run(() => actions.deletePayment(paymentId)),
      emailInvite: (path) => run(() => actions.emailInvite({ path })),
      declineRequest: (q) => run(() => actions.declineRequest(q.id)),
      setUserGrants: (p) => run(() => actions.setUserGrants(p)),
      removeCustomer: (customerId) => run(() => actions.removeCustomer(customerId)),
      restoreCustomer: (customerId) => run(() => actions.restoreCustomer(customerId)),
      setUserDisabled: (userId, disabled) =>
        run(() => actions.setUserDisabled({ userId, disabled })),
      passwordResetLink: (userId) => run(() => actions.passwordResetLink({ userId })),
      setUserPassword: (userId, password) => run(() => actions.setUserPassword({ userId, password })),
      updateCustomer: (c) => run(() => actions.updateCustomer(c)),
      updateIngredient: (i) => run(() => actions.updateIngredient(i)),
      updateProduct: (p) => run(() => actions.updateProduct(p)),
      updateHouse: (h) => run(() => actions.updateHouse(h)),
      deleteInvItem: (id) => run(() => actions.deleteInvItem({ id })),
      updateInvItem: (i) => run(() => actions.updateInvItem(i)),
      deleteEntry: (kind, id) => run(() => actions.deleteEntry({ kind, id })),
      deleteEntries: (kind, ids) => run(() => actions.deleteEntries({ kind, ids })),
      addManure: (m) => run(() => actions.addManure(m)),
      addFinanceEntry: (e) => run(() => actions.addFinanceEntry(e)),
      setFinanceMonth: (m) => run(() => actions.setFinanceMonth(m)),
      setBatchCosts: (c) => run(() => actions.setBatchCosts(c)),
      setBroilerBatchCosts: (c) => run(() => actions.setBroilerBatchCosts(c)),
      addBroilerHouse: (x) => run(() => actions.addBroilerHouse(x)),
      updateBroilerHouse: (x) => run(() => actions.updateBroilerHouse(x)),
      deleteBroilerHouse: (x) => run(() => actions.deleteBroilerHouse(x)),
      addBroilerBatch: (x) => run(() => actions.addBroilerBatch(x)),
      updateBroilerBatch: (x) => run(() => actions.updateBroilerBatch(x)),
      closeBroilerBatch: (x) => run(() => actions.closeBroilerBatch(x)),
      deleteBroilerBatch: (x) => run(() => actions.deleteBroilerBatch(x)),
      addBroilerDaily: (x) => run(() => actions.addBroilerDaily(x)),
      addBroilerWeighing: (x) => run(() => actions.addBroilerWeighing(x)),
      addBroilerFeedDelivery: (x) => run(() => actions.addBroilerFeedDelivery(x)),
      addBroilerHealth: (x) => run(() => actions.addBroilerHealth(x)),
      sellBroilers: (x) => run(() => actions.sellBroilers(x)),
      dispatchToLayers: (x) => run(() => actions.dispatchToLayers(x)),
      addAnimal: (x) => run(() => actions.addAnimal(x)),
      recordBirth: (x) => run(() => actions.recordBirth(x)),
      updateAnimal: (x) => run(() => actions.updateAnimal(x)),
      animalLeft: (x) => run(() => actions.animalLeft(x)),
      addAnimalWeight: (x) => run(() => actions.addAnimalWeight(x)),
      addAnimalHealth: (x) => run(() => actions.addAnimalHealth(x)),
      addRuminantFeed: (x) => run(() => actions.addRuminantFeed(x)),
      sellAnimals: (x) => run(() => actions.sellAnimals(x)),
      processBroilers: (x) => run(() => actions.processBroilers(x)),
      sellProcessed: (x) => run(() => actions.sellProcessed(x)),
      addBroilerExpense: (x) => run(() => actions.addBroilerExpense(x)),
      addProduction: (house, eggs, cracked, rejects = 0, date, batch) =>
        run(() => actions.addProduction({ house, batch, eggs, cracked, rejects, date })),
      addEggMove: (type, crates, reason = "", date) =>
        run(() => actions.addEggMove({ type, crates, reason, date })),
      reviewEggMove: (id, approve) => run(() => actions.reviewEggMove({ id, approve })),
      logFeedUse: (house, kg, product, date, batch) => run(() => actions.logFeedUse({ house, batch, kg, product, date })),
      addCustomer: (c) => run(() => actions.addCustomer(c)),
      addIngredient: (i) => run(() => actions.addIngredient(i)),
      addProduct: (p) => run(() => actions.addProduct(p)),
      addBatch: (b) => run(() => actions.addBatch(b)),
      recordMortality: (m) => run(() => actions.recordMortality(m)),
      setInLay: (batch, date) => run(() => actions.setInLay({ batch, date })),
      placeBatch: (p) => run(() => actions.placeBatch(p)),
      updateBatch: (b) => run(() => actions.updateBatch(b)),
      deleteBatch: (batch) => run(() => actions.deleteBatch({ batch })),
      deleteHouse: (code) => run(() => actions.deleteHouse({ code })),
      addDailyRecords: (d) => run(() => actions.addDailyRecords(d)),
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
      giveVaccination: (id, qtyUsed, date) => run(() => actions.giveVaccination({ id, qtyUsed, date })),
      addMedication: (m) => run(() => actions.addMedication(m)),
      addInvoice: (v) => run(() => actions.addInvoice(v)),
      recordAdvance: (p) => run(() => actions.recordAdvance(p)),
      markOrderPaid: (p) => run(() => actions.markOrderPaid(p)),
      undoOrderPayment: (orderId) => run(() => actions.undoOrderPayment({ orderId })),
      clearEggData: (upTo, confirm) => run(() => actions.clearEggData({ upTo, confirm: confirm as "CLEAR" })),
      refundCredit: (p) => run(() => actions.refundCredit(p)),
      addOrder: (o) => run(() => actions.addOrder(o)),
    };
  }, [data, saving, router, pathname]);

  return (
    <ErpContext.Provider value={value}>
      {children}
      {error ? (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-[#f0cfc9] bg-[#fbeae7] px-4 py-3 text-[13px] text-[#8a2f22] shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss"
            className="font-bold text-[#c7402f]"
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
  const pendingOrders = data.orders.filter((o) => o.status === "pending" && o.paidAt).length;
  const pendingReqs = data.reqs.filter((q) => q.status === "pending").length;
  const pendingReceipts = data.proofs.filter((p) => p.status === "submitted").length;
  const seen = useRef({ orders: pendingOrders, requests: pendingReqs, receipts: pendingReceipts });
  seen.current = { orders: pendingOrders, requests: pendingReqs, receipts: pendingReceipts };

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
      const now = (await res.json()) as { orders: number; requests: number; receipts: number };
      const before = seen.current;
      if (now.orders === before.orders && now.requests === before.requests && now.receipts === before.receipts) return;
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

/** The ERP's in-flight flag, or false outside the ERP (e.g. the buyer portal). */
export function useErpSaving(): boolean {
  return useContext(ErpContext)?.saving ?? false;
}

export function useErp(): ErpState {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used inside ErpProvider");
  return ctx;
}
