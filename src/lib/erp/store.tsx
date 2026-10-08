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
 * Writes are fire-and-forget for the forms; failures surface as a toast.
 */
type ErpState = ErpData & {
  /** True while a write is in flight. */
  saving: boolean;
  // workflow actions
  fulfilOrder: (o: EggOrder) => void;
  declineOrder: (o: EggOrder) => void;
  markPaid: (v: Invoice) => void;
  fulfilRequest: (q: FeedRequest) => void;
  setCratePrice: (price: number) => Promise<ActionResult>;
  /** Each resolves with the invite link's path, e.g. "/invite/abc…". */
  inviteStaff: (input: { name: string; email: string }) => Promise<
    ActionResult<{ path: string }>
  >;
  inviteBuyer: (input: { customerId: number; email: string }) => Promise<
    ActionResult<{ path: string }>
  >;
  revokeInvite: (inviteId: number) => void;
  // create actions — one per model
  addProduction: (house: string, eggs: number, cracked: number) => void;
  addEggMove: (type: "in" | "out", crates: number) => void;
  logFeedUse: (house: string, kg: number) => void;
  addCustomer: (c: Omit<Customer, "id" | "logins">) => void;
  addIngredient: (i: Omit<Ingredient, "id">) => void;
  addProduct: (p: Omit<Product, "id">) => void;
  addBatch: (b: Batch) => void;
  addHouse: (h: House) => void;
  addInvItem: (i: Omit<InvItem, "id">) => void;
  addInvMove: (m: Omit<InvMove, "date">) => void;
  addDelivery: (d: Omit<Delivery, "date">) => void;
  addRun: (r: Omit<Run, "id" | "date">) => void;
  addFeedSale: (s: Omit<FeedSale, "id" | "date">) => void;
  addFeedRequest: (q: Omit<FeedRequest, "id" | "date" | "status">) => void;
  addLayersFeedDelivery: (d: Omit<LayersFeedDelivery, "id" | "date">) => void;
  addWaterLog: (w: Omit<WaterLog, "date">) => void;
  addVaccination: (v: Omit<VaccinationRec, "date">) => void;
  addMedication: (m: Omit<MedicationRec, "date">) => void;
  addInvoice: (v: Omit<Invoice, "id" | "date">) => void;
  addOrder: (o: Omit<EggOrder, "id" | "date" | "status" | "notes">) => void;
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
    const fire = (write: () => Promise<ActionResult>) => {
      void run(write);
    };

    return {
      ...data,
      saving,
      fulfilOrder: (o) => fire(() => actions.fulfilOrder(o.id)),
      declineOrder: (o) => fire(() => actions.declineOrder(o.id)),
      markPaid: (v) => fire(() => actions.markPaid(v.id)),
      fulfilRequest: (q) => fire(() => actions.fulfilRequest(q.id)),
      setCratePrice: (price) => run(() => actions.setCratePrice(price)),
      inviteStaff: (input) => run(() => actions.inviteStaff(input)),
      inviteBuyer: (input) => run(() => actions.inviteBuyer(input)),
      revokeInvite: (inviteId) => fire(() => actions.revokeInvite(inviteId)),
      addProduction: (house, eggs, cracked) =>
        fire(() => actions.addProduction({ house, eggs, cracked })),
      addEggMove: (type, crates) => fire(() => actions.addEggMove({ type, crates })),
      logFeedUse: (house, kg) => fire(() => actions.logFeedUse({ house, kg })),
      addCustomer: (c) => fire(() => actions.addCustomer(c)),
      addIngredient: (i) => fire(() => actions.addIngredient(i)),
      addProduct: (p) => fire(() => actions.addProduct(p)),
      addBatch: (b) => fire(() => actions.addBatch(b)),
      addHouse: (h) => fire(() => actions.addHouse(h)),
      addInvItem: (i) => fire(() => actions.addInvItem(i)),
      addInvMove: (m) => fire(() => actions.addInvMove(m)),
      addDelivery: (d) => fire(() => actions.addDelivery(d)),
      addRun: (r) => fire(() => actions.addRun(r)),
      addFeedSale: (s) => fire(() => actions.addFeedSale(s)),
      addFeedRequest: (q) => fire(() => actions.addFeedRequest(q)),
      addLayersFeedDelivery: (d) => fire(() => actions.addLayersFeedDelivery(d)),
      addWaterLog: (w) => fire(() => actions.addWaterLog(w)),
      addVaccination: (v) => fire(() => actions.addVaccination(v)),
      addMedication: (m) => fire(() => actions.addMedication(m)),
      addInvoice: (v) => fire(() => actions.addInvoice(v)),
      addOrder: (o) => fire(() => actions.addOrder(o)),
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
