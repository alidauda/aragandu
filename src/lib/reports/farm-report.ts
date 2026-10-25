import { canSee, isFarmWide, locationsOf, roleLabels, SCOPE_LABEL, type Area, type Grants } from "@/lib/access";
import {
  activeBirds,
  balance,
  eggStock,
  feedCostPerCrate,
  finishedPositions,
  fmtK,
  fmtN,
  ingredientPositions,
  inventoryPositions,
  locationPositions,
  receivablesAging,
  runPositions,
  withdrawals,
} from "@/lib/erp/derive";
import { farmStamp } from "@/lib/dates";
import { isDivisionBuyer } from "@/lib/erp/divisions";
import type { ErpData } from "@/lib/erp/types";
import { LEDGER_KIND, ledgerTotals, type LedgerEntry } from "@/lib/ledger";
import { invNo, PAYMENT_METHOD } from "@/lib/orders";
import { periodRange } from "@/lib/period";
import type { Column, FarmReport, ReportSection, ReportTable, Stat } from "@/lib/reports/types";

/** When each row was entered — in the workbook, not the printout. */
const RECORDED: Column = { key: "recorded", label: "Recorded", sheetOnly: true };
const rec = (at?: string) => (at ? farmStamp(at) : null);

/**
 * The comprehensive farm report for a period. Pure: it reads the ERP data
 * (already cut to the viewer's division) and the payment ledger, and
 * returns sections of figures and tables — only those the viewer may see.
 * The printable page and the Excel workbook are both drawn from this.
 */

const EGGS = "Eggs (crates)";
const pct = (n: number, d: number) => (d ? n / d : 0);
const pctLabel = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function buildFarmReport(o: {
  data: ErpData;
  ledger: LedgerEntry[] | null;
  from: string;
  to: string;
  /** The viewer's roles: only the sections they may see are built. */
  grants: Grants;
  generatedBy: string;
  generatedAt: string;
}): FarmReport {
  const { data: d, from, to, grants } = o;
  const can = (a: Area) => canSee(grants, a);
  const mine = locationsOf(grants);
  const store = mine && mine.length === 1 ? mine[0] : null;
  const inP = (date: string) => date >= from && date <= to;
  const sections: ReportSection[] = [];
  const summary: Stat[] = [];
  const product = (id: number) => d.products.find((p) => p.id === id);
  const item = (id: number) => d.invItems.find((i) => i.id === id)?.name ?? "—";

  // ── Sales ──────────────────────────────────────────────────────────────────
  if (can("eggsales")) {
    const inv = d.invoices.filter((v) => inP(v.date));
    const eggInv = inv.filter((v) => v.product === EGGS);
    const henInv = inv.filter((v) => v.product !== EGGS);
    const invoiced = sum(inv, (v) => v.qty * v.price);
    const unpaid = sum(inv.filter((v) => v.status === "pending"), balance);
    const buyers = [...new Set(inv.map((v) => v.name))].sort();
    const byBuyer = buyers.map((name) => {
      const mine = inv.filter((v) => v.name === name);
      return {
        buyer: name,
        invoices: mine.length,
        crates: sum(mine.filter((v) => v.product === EGGS), (v) => v.qty),
        hens: sum(mine.filter((v) => v.product !== EGGS), (v) => v.qty),
        amount: sum(mine, (v) => v.qty * v.price),
        paid: sum(mine, (v) => v.paid),
        balance: sum(mine, balance),
      };
    });
    summary.push({ label: "Sales invoiced", value: fmtN(invoiced), sub: `${inv.length} invoices` });
    sections.push({
      key: "sales",
      title: "Sales",
      note: "Invoices raised in the period (egg crates and spent hens), by invoice date.",
      stats: [
        { label: "Invoiced", value: fmtN(invoiced), sub: `${inv.length} invoices` },
        { label: "Egg crates sold", value: fmtK(sum(eggInv, (v) => v.qty)), sub: fmtN(sum(eggInv, (v) => v.qty * v.price)) },
        { label: "Spent hens sold", value: fmtK(sum(henInv, (v) => v.qty)), sub: fmtN(sum(henInv, (v) => v.qty * v.price)) },
        { label: "Still unpaid", value: fmtN(unpaid), sub: "of the period's invoices" },
      ],
      tables: [
        {
          title: "Sales by buyer",
          columns: [
            { key: "buyer", label: "Buyer" },
            { key: "invoices", label: "Invoices", kind: "number" },
            { key: "crates", label: "Crates", kind: "number" },
            { key: "hens", label: "Hens", kind: "number" },
            { key: "amount", label: "Amount", kind: "money" },
            { key: "paid", label: "Paid", kind: "money" },
            { key: "balance", label: "Balance", kind: "money" },
          ],
          rows: byBuyer,
          totals: {
            buyer: "Total",
            invoices: inv.length,
            crates: sum(eggInv, (v) => v.qty),
            hens: sum(henInv, (v) => v.qty),
            amount: invoiced,
            paid: sum(inv, (v) => v.paid),
            balance: sum(inv, balance),
          },
        },
        {
          title: "Invoices",
          columns: [
            { key: "number", label: "Invoice" },
            { key: "date", label: "Date", kind: "date" },
            { key: "buyer", label: "Buyer" },
            { key: "item", label: "Item" },
            { key: "qty", label: "Qty", kind: "number" },
            { key: "price", label: "Unit price", kind: "money" },
            { key: "amount", label: "Amount", kind: "money" },
            { key: "paid", label: "Paid", kind: "money" },
            { key: "balance", label: "Balance", kind: "money" },
            { key: "status", label: "Status" },
            RECORDED,
          ],
          rows: [...inv]
            .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
            .map((v) => ({
              number: invNo(v.id),
              date: v.date,
              buyer: v.name,
              item: v.product,
              qty: v.qty,
              price: v.price,
              amount: v.qty * v.price,
              paid: v.paid,
              balance: balance(v),
              status: v.status,
              recorded: rec(v.createdAt),
            })),
        },
      ],
    });
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  if (can("eggsales")) {
    const ord = d.orders.filter((x) => inP(x.date));
    const live = ord.filter((x) => x.status !== "declined");
    const fulfilled = ord.filter((x) => x.status === "fulfilled");
    const declined = ord.filter((x) => x.status === "declined");
    const buyerName = (id: number) => d.customers.find((c) => c.id === id)?.name ?? `Buyer #${id}`;
    const ids = [...new Set(ord.map((x) => x.cust))];
    summary.push({ label: "Crates ordered", value: fmtK(sum(live, (x) => x.crates)), sub: `${live.length} orders` });
    sections.push({
      key: "orders",
      title: "Egg orders",
      note: "Orders placed in the period. Orders are paid when placed; only paid orders are fulfilled.",
      stats: [
        { label: "Orders placed", value: String(ord.length), sub: `${fmtK(sum(ord, (x) => x.crates))} crates` },
        { label: "Paid", value: String(ord.filter((x) => x.paidAt).length), sub: "paid for up front" },
        { label: "Fulfilled", value: fmtK(sum(fulfilled, (x) => x.crates)), sub: "crates sent" },
        { label: "Declined or released", value: String(declined.length), sub: `${fmtK(sum(declined, (x) => x.crates))} crates` },
      ],
      tables: [
        {
          title: "Orders by buyer",
          columns: [
            { key: "buyer", label: "Buyer" },
            { key: "orders", label: "Orders", kind: "number" },
            { key: "ordered", label: "Crates ordered", kind: "number" },
            { key: "fulfilled", label: "Crates fulfilled", kind: "number" },
            { key: "declined", label: "Declined / released", kind: "number" },
            { key: "value", label: "Value (locked price)", kind: "money" },
          ],
          rows: ids
            .map((id) => {
              const mine = ord.filter((x) => x.cust === id);
              return {
                buyer: buyerName(id),
                orders: mine.length,
                ordered: sum(mine.filter((x) => x.status !== "declined"), (x) => x.crates),
                fulfilled: sum(mine.filter((x) => x.status === "fulfilled"), (x) => x.crates),
                declined: mine.filter((x) => x.status === "declined").length,
                value: sum(mine.filter((x) => x.status !== "declined"), (x) => x.crates * (x.price ?? 0)),
              };
            })
            .sort((a, b) => b.ordered - a.ordered),
        },
        {
          title: "Orders",
          columns: [
            { key: "id", label: "Order" },
            { key: "date", label: "Date", kind: "date" },
            { key: "buyer", label: "Buyer" },
            { key: "crates", label: "Crates", kind: "number" },
            { key: "price", label: "Price", kind: "money" },
            { key: "total", label: "Total", kind: "money" },
            { key: "paid", label: "Paid" },
            { key: "status", label: "Status" },
            RECORDED,
          ],
          rows: [...ord]
            .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
            .map((x) => ({
              id: `#${x.id}`,
              date: x.date,
              buyer: buyerName(x.cust),
              crates: x.crates,
              price: x.price ?? null,
              total: x.crates * (x.price ?? 0),
              paid: x.paidAt ? "yes" : "no",
              status: x.status === "declined" ? `declined${x.declineReason ? ` (${x.declineReason})` : ""}` : x.status,
              recorded: rec(x.createdAt),
            })),
        },
      ],
    });
  }

  // ── Money ──────────────────────────────────────────────────────────────────
  if (can("money") && o.ledger) {
    const t = ledgerTotals(o.ledger);
    const asOf = d.today;
    const aging = receivablesAging(d.invoices.filter((v) => v.cust !== null), asOf);
    const owed = sum(d.invoices.filter((v) => v.status === "pending"), balance);
    const credit = sum(d.customers, (c) => Math.max(0, c.credit));
    const debtors = d.customers
      .map((c) => {
        const open = d.invoices.filter((v) => v.cust === c.id && v.status === "pending");
        const oldest = open.map((v) => v.date).sort()[0] ?? "";
        return { buyer: c.name, phone: c.phone, invoices: open.length, owed: sum(open, balance), oldest, days: oldest ? daysBetween(oldest, asOf) : null };
      })
      .filter((x) => x.owed > 0)
      .sort((a, b) => b.owed - a.owed);
    summary.push({ label: "Money received", value: fmtN(t.received), sub: t.refunded ? `${fmtN(t.refunded)} refunded` : "no refunds" });
    sections.push({
      key: "money",
      title: "Money",
      note: "Payments by the day the money arrived. Outstanding, ageing and credit are as of today.",
      stats: [
        { label: "Received", value: fmtN(t.received), sub: `${o.ledger.filter((e) => e.amount > 0 && e.kind !== "credit-used").length} payments` },
        { label: "Refunded", value: fmtN(t.refunded) },
        { label: "Outstanding today", value: fmtN(owed), sub: `${debtors.length} buyers owe` },
        { label: "Buyer credit held", value: fmtN(credit), sub: "advances and money from unfilled orders" },
      ],
      tables: [
        {
          title: "Received by method",
          columns: [
            { key: "method", label: "Method" },
            { key: "amount", label: "Amount", kind: "money" },
            { key: "share", label: "Share", kind: "percent" },
          ],
          rows: t.byMethod.map((m) => ({ method: m.label, amount: m.amount, share: pct(m.amount, t.received) })),
          totals: { method: "Total", amount: t.received, share: t.received ? 1 : 0 },
        },
        {
          title: "Payments",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "buyer", label: "Buyer" },
            { key: "type", label: "Type" },
            { key: "for", label: "For" },
            { key: "method", label: "Method" },
            { key: "reference", label: "Reference" },
            { key: "by", label: "Recorded by" },
            { key: "amount", label: "Amount", kind: "money" },
            RECORDED,
          ],
          rows: [...o.ledger]
            .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
            .map((e) => ({
              date: e.date,
              buyer: e.buyer,
              type: LEDGER_KIND[e.kind],
              for: e.for,
              method: e.method ? PAYMENT_METHOD[e.method] : "",
              reference: e.reference,
              by: e.by,
              amount: e.amount,
              recorded: rec(e.at),
            })),
        },
        {
          title: "Receivables ageing",
          note: "What buyers owe today, by the age of the invoice.",
          columns: [
            { key: "age", label: "Age" },
            { key: "amount", label: "Owed", kind: "money" },
          ],
          rows: [
            { age: "Up to 7 days", amount: aging.current },
            { age: "8–30 days", amount: aging.d30 },
            { age: "31–60 days", amount: aging.d60 },
            { age: "Over 60 days", amount: aging.over60 },
          ],
          totals: { age: "Total", amount: aging.current + aging.d30 + aging.d60 + aging.over60 },
        },
        {
          title: "Debtors",
          columns: [
            { key: "buyer", label: "Buyer" },
            { key: "phone", label: "Phone" },
            { key: "invoices", label: "Unpaid invoices", kind: "number" },
            { key: "owed", label: "Owed", kind: "money" },
            { key: "oldest", label: "Oldest unpaid", kind: "date" },
            { key: "days", label: "Days outstanding", kind: "number" },
          ],
          rows: debtors,
          totals: { buyer: "Total", invoices: sum(debtors, (x) => x.invoices), owed: sum(debtors, (x) => x.owed) },
        },
      ],
    });
  }

  // ── Egg production ─────────────────────────────────────────────────────────
  if (can("layers")) {
    const prod = d.prodLog.filter((p) => inP(p.date));
    const eggs = sum(prod, (p) => p.eggs);
    const cracked = sum(prod, (p) => p.cracked);
    const rejects = sum(prod, (p) => p.rejects);
    const withheld = sum(prod, (p) => p.withheld);
    const good = eggs - cracked - rejects - withheld;
    const days = new Set(prod.map((p) => p.date)).size;
    const birds = activeBirds(d.batches, to > d.today ? d.today : to);
    const houses = [...new Set(prod.map((p) => p.house))].sort();
    const dates = [...new Set(prod.map((p) => p.date))].sort();
    summary.push({ label: "Eggs collected", value: fmtK(eggs), sub: `≈ ${fmtK(good / d.eggsPerCrate)} crates good` });
    sections.push({
      key: "production",
      title: "Egg production",
      note: "Daily collections by house. Good eggs = total − cracked − rejects − withheld (drug withdrawal).",
      stats: [
        { label: "Eggs collected", value: fmtK(eggs), sub: `${days} days logged` },
        { label: "Good eggs", value: fmtK(good), sub: `≈ ${fmtK(good / d.eggsPerCrate)} crates` },
        { label: "Cracked + rejects", value: pctLabel(cracked + rejects, eggs), sub: `${fmtK(cracked + rejects)} eggs` },
        {
          label: "Lay rate",
          value: days && birds ? `${((100 * eggs) / days / birds).toFixed(1)}%` : "—",
          sub: `average a day ÷ ${fmtK(birds)} birds in lay`,
        },
      ],
      tables: [
        {
          title: "Production by house",
          columns: [
            { key: "house", label: "House" },
            { key: "days", label: "Days", kind: "number" },
            { key: "eggs", label: "Eggs", kind: "number" },
            { key: "cracked", label: "Cracked", kind: "number" },
            { key: "rejects", label: "Rejects", kind: "number" },
            { key: "withheld", label: "Withheld", kind: "number" },
            { key: "good", label: "Good", kind: "number" },
            { key: "perDay", label: "Eggs a day", kind: "number" },
          ],
          rows: houses.map((h) => {
            const mine = prod.filter((p) => p.house === h);
            const n = new Set(mine.map((p) => p.date)).size;
            const e = sum(mine, (p) => p.eggs);
            return {
              house: h,
              days: n,
              eggs: e,
              cracked: sum(mine, (p) => p.cracked),
              rejects: sum(mine, (p) => p.rejects),
              withheld: sum(mine, (p) => p.withheld),
              good: sum(mine, (p) => p.eggs - p.cracked - p.rejects - p.withheld),
              perDay: n ? Math.round(e / n) : 0,
            };
          }),
          totals: { house: "Total", days, eggs, cracked, rejects, withheld, good, perDay: days ? Math.round(eggs / days) : 0 },
        },
        {
          title: "Daily production",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "eggs", label: "Eggs", kind: "number" },
            { key: "cracked", label: "Cracked", kind: "number" },
            { key: "rejects", label: "Rejects", kind: "number" },
            { key: "withheld", label: "Withheld", kind: "number" },
            { key: "good", label: "Good", kind: "number" },
          ],
          rows: dates.map((day) => {
            const mine = prod.filter((p) => p.date === day);
            return {
              date: day,
              eggs: sum(mine, (p) => p.eggs),
              cracked: sum(mine, (p) => p.cracked),
              rejects: sum(mine, (p) => p.rejects),
              withheld: sum(mine, (p) => p.withheld),
              good: sum(mine, (p) => p.eggs - p.cracked - p.rejects - p.withheld),
            };
          }),
        },
      ],
    });

    // ── Egg store ──
    const moves = d.eggMoves.filter((m) => inP(m.date) && m.status === "approved");
    const opening = sum(moves.filter((m) => m.type === "in" && m.reason === "opening stock"), (m) => m.crates);
    const graded = sum(moves.filter((m) => m.type === "in" && m.reason !== "opening stock"), (m) => m.crates);
    const outs = moves.filter((m) => m.type === "out");
    const written = sum(outs, (m) => m.crates);
    const sold = sum(d.invoices.filter((v) => inP(v.date) && v.product === EGGS), (v) => v.qty);
    const reasons = [...new Set(outs.map((m) => m.reason))];
    sections.push({
      key: "eggstore",
      title: "Egg store",
      note: "Crates graded into the store, sold and written off in the period; stock is as of today.",
      stats: [
        { label: "Graded in", value: fmtK(graded), sub: opening ? `+ ${fmtK(opening)} opening stock` : "from collections" },
        { label: "Sold", value: fmtK(sold), sub: "crates on invoices" },
        { label: "Written off", value: fmtK(written), sub: `${pctLabel(written, graded)} of graded` },
        { label: "In store today", value: fmtK(eggStock(d.eggMoves, d.invoices)), sub: "crates" },
      ],
      tables: [
        {
          title: "Write-offs by reason",
          columns: [
            { key: "reason", label: "Reason" },
            { key: "times", label: "Times", kind: "number" },
            { key: "crates", label: "Crates", kind: "number" },
          ],
          rows: reasons.map((r) => ({
            reason: r,
            times: outs.filter((m) => m.reason === r).length,
            crates: sum(outs.filter((m) => m.reason === r), (m) => m.crates),
          })),
          totals: { reason: "Total", times: outs.length, crates: written },
        },
      ],
    });

    // ── Flock ──
    const out = d.birdOuts.filter((b) => inP(b.date));
    const by = (r: "died" | "culled" | "sold") => sum(out.filter((b) => b.reason === r), (b) => b.birds);
    const active = d.batches.filter((b) => b.st === "active");
    summary.push({ label: "Birds now", value: fmtK(sum(active, (b) => b.birds - b.mortality)), sub: `${active.length} active batches` });
    sections.push({
      key: "flock",
      title: "Flock",
      note: "Batches today; birds out (died, culled, sold) in the period.",
      stats: [
        { label: "Birds now", value: fmtK(sum(active, (b) => b.birds - b.mortality)), sub: `${active.length} active batches` },
        { label: "Birds in lay", value: fmtK(activeBirds(d.batches, d.today)) },
        { label: "Died", value: fmtK(by("died")), sub: `${fmtK(by("culled"))} culled` },
        { label: "Spent hens sold", value: fmtK(by("sold")) },
      ],
      tables: [
        {
          title: "Batches",
          columns: [
            { key: "batch", label: "Batch" },
            { key: "house", label: "House" },
            { key: "breed", label: "Breed" },
            { key: "received", label: "Arrived", kind: "date" },
            { key: "inLay", label: "In lay since", kind: "date" },
            { key: "placed", label: "Placed", kind: "number" },
            { key: "out", label: "Out (all time)", kind: "number" },
            { key: "now", label: "Birds now", kind: "number" },
            { key: "status", label: "Status" },
            RECORDED,
          ],
          rows: d.batches.map((b) => ({
            batch: b.batch,
            house: b.house,
            breed: b.breed,
            received: b.received,
            inLay: b.inLay ?? null,
            placed: b.birds,
            out: b.mortality,
            now: b.birds - b.mortality,
            status: b.st,
            recorded: rec(b.createdAt),
          })),
        },
        {
          title: "Birds out",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "batch", label: "Batch" },
            { key: "reason", label: "Reason" },
            { key: "birds", label: "Birds", kind: "number" },
            { key: "by", label: "Recorded by" },
            RECORDED,
          ],
          rows: [...out].sort((a, b) => a.date.localeCompare(b.date)).map((b) => ({ date: b.date, batch: b.batch, reason: b.reason, birds: b.birds, by: b.by, recorded: rec(b.createdAt) })),
          totals: { date: "Total", birds: sum(out, (b) => b.birds) },
        },
      ],
    });

    // ── Feed & water ──
    const ext = d.layersFeedDeliveries.filter((x) => inP(x.date));
    const mill = d.feedSales.filter((s) => inP(s.date) && s.channel === "internal" && isDivisionBuyer(s.buyer, "layers"));
    const used = d.feedUse.filter((u) => inP(u.date));
    const water = d.waterLogs.filter((w) => inP(w.date));
    const cost = feedCostPerCrate(
      { external: d.layersFeedDeliveries, feedSales: d.feedSales, products: d.products, feedUse: d.feedUse, moves: d.eggMoves },
      from,
      to
    );
    const feedHouses = [...new Set([...used.map((u) => u.house), ...water.map((w) => w.house)])].sort();
    sections.push({
      key: "feedwater",
      title: "Layers feed & water",
      note: "Feed bought in and sent by the mill, feed used and water drunk in the period.",
      stats: [
        { label: "Feed received", value: `${fmtK(sum(ext, (x) => x.kg) + sum(mill, (s) => s.bags * (product(s.product)?.bag ?? 0)))} kg`, sub: `${fmtN(sum(ext, (x) => x.kg * x.pricePerKg) + sum(mill, (s) => s.bags * s.price))} spent` },
        { label: "Feed used", value: `${fmtK(sum(used, (u) => u.kg))} kg` },
        { label: "Feed cost per crate", value: cost.perCrate ? fmtN(cost.perCrate) : "—", sub: cost.perKg ? `${fmtN(cost.perKg)}/kg average` : "" },
        { label: "Water", value: `${fmtK(sum(water, (w) => w.litres))} L` },
      ],
      tables: [
        {
          title: "Feed and water by house",
          columns: [
            { key: "house", label: "House" },
            { key: "feed", label: "Feed used (kg)", kind: "number" },
            { key: "water", label: "Water (L)", kind: "number" },
          ],
          rows: feedHouses.map((h) => ({
            house: h,
            feed: sum(used.filter((u) => u.house === h), (u) => u.kg),
            water: sum(water.filter((w) => w.house === h), (w) => w.litres),
          })),
          totals: { house: "Total", feed: sum(used, (u) => u.kg), water: sum(water, (w) => w.litres) },
        },
        {
          title: "Feed received",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "source", label: "From" },
            { key: "kg", label: "Kg", kind: "number" },
            { key: "perKg", label: "Price per kg", kind: "money" },
            { key: "cost", label: "Cost", kind: "money" },
            RECORDED,
          ],
          rows: [
            ...ext.map((x) => ({ date: x.date, source: x.supplier, kg: x.kg, perKg: x.pricePerKg, cost: x.kg * x.pricePerKg, recorded: rec(x.createdAt) })),
            ...mill.map((s) => {
              const kg = s.bags * (product(s.product)?.bag ?? 0);
              return { date: s.date, source: `Feed mill — ${product(s.product)?.name ?? ""}`, kg, perKg: kg ? (s.bags * s.price) / kg : 0, cost: s.bags * s.price, recorded: rec(s.createdAt) };
            }),
          ].sort((a, b) => String(a.date).localeCompare(String(b.date))),
        },
      ],
    });

    // ── Health ──
    const vax = d.vaccinations.filter((v) => inP(v.date));
    const meds = d.medications.filter((m) => inP(m.date));
    const held = withdrawals(d.vaccinations, d.medications, d.today);
    sections.push({
      key: "health",
      title: "Health",
      note: "Vaccinations and treatments in the period.",
      stats: [
        { label: "Doses given", value: String(vax.filter((v) => v.status === "done").length) },
        { label: "Scheduled", value: String(vax.filter((v) => v.status !== "done").length) },
        { label: "Treatments", value: String(meds.length) },
        { label: "Houses under withdrawal", value: String(held.size), sub: held.size ? [...held.keys()].join(", ") : "none today" },
      ],
      tables: [
        {
          title: "Vaccinations",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "batch", label: "Batch" },
            { key: "house", label: "House" },
            { key: "item", label: "Vaccine" },
            { key: "route", label: "Route" },
            { key: "qty", label: "Qty", kind: "number" },
            { key: "status", label: "Status" },
            RECORDED,
          ],
          rows: vax.map((v) => ({ date: v.date, batch: v.batch, house: v.house, item: item(v.item), route: v.route, qty: v.qtyUsed, status: v.status, recorded: rec(v.createdAt) })),
        },
        {
          title: "Medication",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "batch", label: "Batch" },
            { key: "item", label: "Drug" },
            { key: "reason", label: "Reason" },
            { key: "dosage", label: "Dosage" },
            { key: "qty", label: "Qty", kind: "number" },
            RECORDED,
          ],
          rows: meds.map((m) => ({ date: m.date, batch: m.batch, item: item(m.item), reason: m.reason, dosage: m.dosage, qty: m.qtyUsed, recorded: rec(m.createdAt) })),
        },
      ],
    });
  }

  // ── Feed mill ──────────────────────────────────────────────────────────────
  if (can("feed")) {
    const runs = runPositions(d.runs, d.products).filter((r) => inP(r.date));
    const sales = d.feedSales.filter((s) => inP(s.date));
    const external = sales.filter((s) => s.channel === "external");
    const internal = sales.filter((s) => s.channel === "internal");
    const deliveries = d.deliveries.filter((x) => inP(x.date));
    const kg = sum(runs, (r) => r.output);
    const cost = sum(runs, (r) => r.cost);
    const ingName = (id: number) => d.ingredients.find((i) => i.id === id)?.name ?? "—";
    summary.push({ label: "Feed produced", value: `${fmtK(kg)} kg`, sub: `${runs.length} runs` });
    sections.push({
      key: "mill",
      title: "Feed mill",
      note: "Production runs, feed sold and issued, and ingredients bought in the period; stock is as of today.",
      stats: [
        { label: "Feed produced", value: `${fmtK(kg)} kg`, sub: `${runs.length} runs` },
        { label: "Cost per kg", value: kg ? fmtN(cost / kg) : "—", sub: `${fmtN(cost)} materials` },
        { label: "Feed sales", value: fmtN(sum(external, (s) => s.bags * s.price)), sub: `${fmtK(sum(external, (s) => s.bags))} bags` },
        { label: "Issued to divisions", value: `${fmtK(sum(internal, (s) => s.bags))} bags`, sub: fmtN(sum(internal, (s) => s.bags * s.price)) },
      ],
      tables: [
        {
          title: "Production runs",
          columns: [
            { key: "run", label: "Run" },
            { key: "date", label: "Date", kind: "date" },
            { key: "product", label: "Product" },
            { key: "charged", label: "Charged (kg)", kind: "number" },
            { key: "output", label: "Output (kg)", kind: "number" },
            { key: "cost", label: "Material cost", kind: "money" },
            { key: "perKg", label: "Cost per kg", kind: "money" },
            RECORDED,
          ],
          rows: runs.map((r) => ({ run: r.run, date: r.date, product: r.pname, charged: r.charged, output: r.output, cost: r.cost, perKg: r.output ? r.cost / r.output : 0, recorded: rec(r.createdAt) })),
          totals: { run: "Total", charged: sum(runs, (r) => r.charged), output: kg, cost, perKg: kg ? cost / kg : 0 },
        },
        {
          title: "Feed sales and issues",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "product", label: "Product" },
            { key: "channel", label: "Channel" },
            { key: "buyer", label: "Buyer" },
            { key: "bags", label: "Bags", kind: "number" },
            { key: "price", label: "Price per bag", kind: "money" },
            { key: "amount", label: "Amount", kind: "money" },
            RECORDED,
          ],
          rows: sales.map((s) => ({ date: s.date, product: product(s.product)?.name ?? "—", channel: s.channel === "internal" ? "issued" : "sale", buyer: s.buyer, bags: s.bags, price: s.price, amount: s.bags * s.price, recorded: rec(s.createdAt) })),
          totals: { date: "Total", bags: sum(sales, (s) => s.bags), amount: sum(sales, (s) => s.bags * s.price) },
        },
        {
          title: "Ingredient deliveries",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "ingredient", label: "Ingredient" },
            { key: "kg", label: "Kg", kind: "number" },
            { key: "price", label: "Price per kg", kind: "money" },
            { key: "cost", label: "Cost", kind: "money" },
            RECORDED,
          ],
          rows: deliveries.map((x) => ({ date: x.date, ingredient: ingName(x.ing), kg: x.kg, price: x.price, cost: x.kg * x.price, recorded: rec(x.createdAt) })),
          totals: { date: "Total", kg: sum(deliveries, (x) => x.kg), cost: sum(deliveries, (x) => x.kg * x.price) },
        },
        {
          title: "Ingredient stock",
          note: "As of today.",
          columns: [
            { key: "ingredient", label: "Ingredient" },
            { key: "onHand", label: "On hand (kg)", kind: "number" },
            { key: "reorder", label: "Reorder at (kg)", kind: "number" },
            { key: "avg", label: "Average ₦/kg", kind: "money" },
            { key: "status", label: "Status" },
          ],
          rows: ingredientPositions(d.ingredients, d.deliveries, d.runs).map((i) => ({ ingredient: i.name, onHand: i.onHand, reorder: i.reorder, avg: i.avg, status: i.st })),
        },
        {
          title: "Finished feed",
          note: "As of today.",
          columns: [
            { key: "product", label: "Product" },
            { key: "bags", label: "Bags", kind: "number" },
            { key: "kg", label: "Kg", kind: "number" },
          ],
          rows: finishedPositions(d.products, d.runs, d.feedSales).map((p) => ({ product: p.name, bags: p.bags, kg: p.onHandKg })),
        },
      ],
    });
  }

  // ── Feed sales (for sales and accounts, who don't see the mill's books) ──────
  if (can("feedsales") && !can("feed")) {
    const sales = d.feedSales.filter((s) => inP(s.date));
    const external = sales.filter((s) => s.channel === "external");
    sections.push({
      key: "feedsales",
      title: "Feed sales",
      note: "Feed sold to outside buyers and issued to divisions in the period.",
      stats: [
        { label: "Feed sales", value: fmtN(sum(external, (s) => s.bags * s.price)), sub: `${fmtK(sum(external, (s) => s.bags))} bags` },
        { label: "Issued to divisions", value: `${fmtK(sum(sales.filter((s) => s.channel === "internal"), (s) => s.bags))} bags` },
      ],
      tables: [
        {
          title: "Feed sales and issues",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "product", label: "Product" },
            { key: "channel", label: "Channel" },
            { key: "buyer", label: "Buyer" },
            { key: "bags", label: "Bags", kind: "number" },
            { key: "price", label: "Price per bag", kind: "money" },
            { key: "amount", label: "Amount", kind: "money" },
            RECORDED,
          ],
          rows: sales.map((s) => ({ date: s.date, product: product(s.product)?.name ?? "—", channel: s.channel === "internal" ? "issued" : "sale", buyer: s.buyer, bags: s.bags, price: s.price, amount: s.bags * s.price, recorded: rec(s.createdAt) })),
          totals: { date: "Total", bags: sum(sales, (s) => s.bags), amount: sum(sales, (s) => s.bags * s.price) },
        },
      ],
    });
  }

  // ── Feed requests ──────────────────────────────────────────────────────────
  if (can("requests")) {
    const reqs = d.reqs.filter((q) => inP(q.date));
    const divisions = [...new Set(reqs.map((q) => q.division))].sort();
    sections.push({
      key: "requests",
      title: "Feed requests",
      note: "Divisions asking the mill for feed in the period.",
      stats: [
        { label: "Requests", value: String(reqs.length), sub: `${fmtK(sum(reqs, (q) => q.bags))} bags` },
        { label: "Fulfilled", value: String(reqs.filter((q) => q.status === "fulfilled").length) },
        { label: "Declined", value: String(reqs.filter((q) => q.status === "declined").length) },
        { label: "Waiting", value: String(reqs.filter((q) => q.status === "pending").length) },
      ],
      tables: [
        {
          title: "Requests by division",
          columns: [
            { key: "division", label: "Division" },
            { key: "requests", label: "Requests", kind: "number" },
            { key: "bags", label: "Bags asked", kind: "number" },
            { key: "fulfilled", label: "Bags issued", kind: "number" },
          ],
          rows: divisions.map((dv) => {
            const mine = reqs.filter((q) => q.division === dv);
            return { division: dv, requests: mine.length, bags: sum(mine, (q) => q.bags), fulfilled: sum(mine.filter((q) => q.status === "fulfilled"), (q) => q.bags) };
          }),
        },
      ],
    });
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  if (can("inventory")) {
    const pos = store ? locationPositions(d.invItems, d.invMoves, store) : inventoryPositions(d.invItems, d.invMoves);
    const moves = d.invMoves.filter((m) => inP(m.date));
    const value = sum(pos, (i) => i.value);
    sections.push({
      key: "inventory",
      title: store ? `Inventory — ${store} store` : "Inventory",
      note: "Positions as of today; movements in the period.",
      stats: [
        { label: "Items", value: String(pos.length) },
        { label: "Stock value", value: fmtN(value) },
        { label: "Low or out", value: String(pos.filter((i) => i.st !== "in-stock").length) },
        { label: "Movements", value: String(moves.length), sub: "in the period" },
      ],
      tables: [
        {
          title: "Stock positions",
          columns: [
            { key: "sku", label: "SKU" },
            { key: "name", label: "Item" },
            { key: "cat", label: "Category" },
            { key: "unit", label: "Unit" },
            { key: "onHand", label: "On hand", kind: "number" },
            { key: "reorder", label: "Reorder at", kind: "number" },
            { key: "value", label: "Value", kind: "money" },
            { key: "status", label: "Status" },
            { key: "expires", label: "Expires", kind: "date" },
          ],
          rows: pos.map((i) => ({ sku: i.sku, name: i.name, cat: i.cat, unit: i.unit, onHand: i.onHand, reorder: i.reorder, value: i.value, status: i.st, expires: i.expiresOn ?? null })),
          totals: { sku: "Total", value },
        },
        {
          title: "Stock movements",
          columns: [
            { key: "date", label: "Date", kind: "date" },
            { key: "item", label: "Item" },
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "qty", label: "Qty", kind: "number" },
            { key: "by", label: "By" },
            RECORDED,
          ],
          rows: [...moves].sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ date: m.date, item: item(m.item), from: m.from ?? "outside", to: m.to ?? "used", qty: m.qty, by: m.by, recorded: rec(m.createdAt) })),
        },
      ],
    });
  }

  const keyFigures: ReportSection = {
    key: "summary",
    title: "Summary",
    note: "The headline figures for the period. Each section below has the detail.",
    stats: summary,
    tables: [],
  };

  return {
    title: isFarmWide(grants)
      ? "Farm report"
      : Object.keys(grants.divisions).length === 1 && !grants.functions.length
        ? `${SCOPE_LABEL[Object.keys(grants.divisions)[0] as keyof typeof SCOPE_LABEL]} report`
        : "Farm report",
    scope: isFarmWide(grants) ? "Whole farm" : roleLabels(grants).join(", "),
    from,
    to,
    periodLabel: periodRange({ from, to }),
    generatedAt: o.generatedAt,
    generatedBy: o.generatedBy,
    sections: [keyFigures, ...sections],
  };
}

export type { FarmReport, ReportTable };
