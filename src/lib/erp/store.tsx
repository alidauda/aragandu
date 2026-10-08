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
import type { ActionResult } from "./actions";
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
  inviteStaff: (input: { name: string; email: string }) => Promise<
    ActionResult<{ path: string }>
  >;
  inviteBuyer: (input: { customerId: number; email: string }) => Promise<
    ActionResult<{ path: string }>
  >;
  revokeInvite: (inviteId: number) => Promise<ActionResult>;
  // create actions — one per model
  addProduction: (house: string, eggs: number, cracked: number) => Promise<ActionResult>;
  addEggMove: (type: "in" | "out", crates: number) => Promise<ActionResult>;
  logFeedUse: (house: string, kg: number) => Promise<ActionResult>;
  /** With an email, also creates the portal invite and returns its link. */
  addCustomer: (
    c: Omit<Customer, "id" | "logins"> & { email: string }
  ) => Promise<ActionResult<{ path: string | null }>>;
  addIngredient: (i: Omit<Ingredient, "id">) => Promise<ActionResult>;
  addProduct: (p: Omit<Product, "id">) => Promise<ActionResult>;
  addBatch: (b: Batch) => Promise<ActionResult>;
  addHouse: (h: House) => Promise<ActionResult>;
  addInvItem: (i: Omit<InvItem, "id">) => Promise<ActionResult>;
  addInvMove: (m: Omit<InvMove, "date">) => Promise<ActionResult>;
  addDelivery: (d: Omit<Delivery, "date">) => Promise<ActionResult>;
  addRun: (r: Omit<Run, "id" | "date">) => Promise<ActionResult>;
  addFeedSale: (s: Omit<FeedSale, "id" | "date">) => Promise<ActionResult>;
  addFeedRequest: (q: Omit<FeedRequest, "id" | "date" | "status">) => Promise<ActionResult>;
  addLayersFeedDelivery: (d: Omit<LayersFeedDelivery, "id" | "date">) => Promise<ActionResult>;
  addWaterLog: (w: Omit<WaterLog, "date">) => Promise<ActionResult>;
  addVaccination: (v: Omit<VaccinationRec, "date">) => Promise<ActionResult>;
  addMedication: (m: Omit<MedicationRec, "date">) => Promise<ActionResult>;
  addInvoice: (v: Omit<Invoice, "id" | "date">) => Promise<ActionResult>;
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
  useFreshOnNavigation();

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
          if (!r.ok) setError(r.error);
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
      addProduction: (house, eggs, cracked) =>
        run(() => actions.addProduction({ house, eggs, cracked })),
      addEggMove: (type, crates) => run(() => actions.addEggMove({ type, crates })),
      logFeedUse: (house, kg) => run(() => actions.logFeedUse({ house, kg })),
      addCustomer: (c) => run(() => actions.addCustomer(c)),
      addIngredient: (i) => run(() => actions.addIngredient(i)),
      addProduct: (p) => run(() => actions.addProduct(p)),
      addBatch: (b) => run(() => actions.addBatch(b)),
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
  }, [data, saving]);

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
 * ledgers on each navigation and when the tab regains focus, so orders
 * placed in the portal show up without a manual reload.
 */
function useFreshOnNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);
}

export function useErp(): ErpState {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used inside ErpProvider");
  return ctx;
}
