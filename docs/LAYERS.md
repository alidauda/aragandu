# Layers division — walkthrough

How the Layers side of the Argandu ERP works: what each screen is for, the
order you use them in during a normal day, how every figure is worked out,
and the rules the app enforces. Everything here is under **Layers** in the
sidebar.

---

## 1. The screens at a glance

| Screen | What it's for | Who records it |
| --- | --- | --- |
| **Overview** | Today's eggs, lay rate, eggs in store, orders waiting, eggs-vs-feed chart | — (read only) |
| **Production** | Each house's daily egg collection | Staff |
| **Egg inventory** | Crates graded into the store, and non-sale outs (breakage, spoilage, use) | Staff |
| **Egg orders** | Buyers' orders (portal or placed for them), fulfil or decline | Staff · crate price: admin |
| **Sales & invoices** | Every sale (crates, spent hens), invoices, payments | Staff record sales · admin records payments |
| **Batches** | Flocks placed, birds alive, deaths, closing a flock | Staff |
| **Houses** | Houses and their capacity, occupancy | Staff add · admin edits capacity |
| **Feed** | Feed bought in, feed from the mill, feed used per house | Staff |
| **Health** | Vaccinations and medication, drawn from the store | Staff |
| **Water** | Litres per house per day | Staff |

Anything waiting for you shows as a green count — on **Egg orders** in the
sidebar, on the bell in the top bar, and in the browser tab title.

**Roles.** Staff record day-to-day work. Admins can also set the crate price,
record or undo payments, edit catalogue details (house capacity, buyers) and
delete wrong entries. See [Corrections](#8-corrections).

---

## 2. Setting up Layers (first time)

Do these once, in this order — each step needs the one before it.

1. **Houses** → *New house*: code (e.g. `H-01`) and capacity in birds.
2. **Batches** → *New batch*: batch number, breed, supplier, number of birds,
   and the house. A house can't be filled past its capacity; you can also
   place a batch with *Not in a house yet*.
3. **Inventory** (Across the farm) → add the vaccines and drugs you use, record
   a receipt into the **store**, then move what Layers needs from the store to
   **layers**. Health records draw from the *layers* location.
4. **Egg orders** → *Change* next to *Crate price* (admin) to set the price per
   crate. Orders can't be fulfilled until a price is set.
5. **Customers** (Across the farm) → add each buyer with their **weekly crate
   allocation**, and invite them to the portal (give an email when adding them,
   or use *Invite* on their row).

---

## 3. A normal day

```
 Morning                  Through the day                 Evening / as needed
 ───────                  ───────────────                 ───────────────────
 Production (per house) → Egg inventory: grade crates in → Egg orders: fulfil / decline
 Water (per house)        Feed: log use per house           Sales: record walk-in sales
 Health (if due)          Batches: record deaths            Sales: record payments (admin)
```

1. **Collect and record eggs** — *Production*: pick the house, enter total eggs,
   cracked and rejects, *Record today's collection*. Do it for each house.
   Several collections a day are fine; they add up.
2. **Grade into crates** — *Egg inventory*: choose **In — graded into store**
   and the number of crates. This is what puts crates on the shelf; production
   on its own does not.
3. **Log water and feed** — *Water* and *Feed*: litres and kg per house.
4. **Record deaths** — *Batches* → *Record deaths* on the batch.
5. **Health** — record any vaccination or treatment given (it takes the doses
   out of the Layers store).
6. **Work the orders** — *Egg orders*: fulfil what you can supply; decline what
   you can't.
7. **Money** — *Sales & invoices*: record walk-in sales; an admin records
   payments as they arrive.

---

## 4. Screen by screen

### Overview

Four figures and a chart:

- **Eggs collected today** (the dark tile) — sum of today's production entries.
- **Lay rate** — today's eggs ÷ birds in lay. Shows "—" when there are no
  active birds.
- **Eggs in store** — crates on hand (see [how stock is worked out](#5-how-the-figures-are-worked-out)).
- **Orders waiting** — pending egg orders.

**Eggs vs feed — daily** shows the last 7 calendar days: eggs collected on
top, feed used underneath, on the same days. A gap means nothing was logged
that day. When the feed line moves and the egg line doesn't follow, look into
it. *Table* switches to the numbers, including grams of feed per bird.

Below: the latest collections and pending portal orders.

### Production

- Fields: **House**, **Total eggs**, **Cracked**, **Rejects**.
- Rules: total eggs must be a whole number above 0; cracked + rejects can't be
  more than the total.
- Table: date, house, total, cracked, rejects, **good eggs** (total − cracked −
  rejects).
- The house list is your real houses; with none set up, the form says *Add a
  house first*.

### Egg inventory

The crate ledger. Two kinds of movement:

- **In — graded into store**: crates packed and put on the shelf.
- **Out — non-sale exit**: breakage, spoilage, crates used on the farm.

Sales are **not** recorded here — a crate invoice takes crates out on its own.
An *out* can't take more crates than are in store.

Figures: **In stock**, **Graded in** (all time), **Sold** (crate invoices),
**Non-sale outs**.

### Egg orders

One list for orders from the **buyer portal** and orders staff place for a
buyer (*Order for buyer*).

Each row shows the buyer, crates, how much of their weekly allocation is used,
the status, and the buyer's note if they left one.

**Rules — the same in the portal and for staff:**

1. **Weekly allocation.** A buyer can order up to their weekly crates across
   the week (Monday–Sunday, Lagos time). Declined orders don't count.
2. **Debt hold.** If a buyer has any unpaid balance on an invoice from **before
   this week**, they can't order and their pending orders can't be fulfilled.
   The row shows *Debt hold — ₦amount*.

**Actions on a pending order:**

- **Fulfil → invoice** — checks there's a crate price, the buyer isn't on hold,
  and there are enough crates in store; then marks the order fulfilled and
  creates an invoice at today's crate price. All of it happens together or not
  at all.
- **Decline** — the order stops counting against the allocation.

**Crate price** (admin) — *Change* next to the price. Applies to orders
fulfilled from then on; existing invoices keep the price they were raised at.

### Sales & invoices

Every sale in one table: date, customer, product, quantity, unit price,
amount, **balance** still owed, status (*Pending*, *Part-paid*, *Paid*).

- **Record sale** — for walk-ins or anything not ordered through the portal:
  customer (or *Walk-in* with a name), product (*Eggs (crates)* or *Spent
  hens*), quantity, unit price, and whether it's already paid. A crate sale
  takes crates out of store and is refused if there aren't enough.
- **Invoice** — opens a printable invoice (print or *Save as PDF*). With email
  set up, staff can *Email to buyer*.
- **Record payment** (admin) — amount, method (transfer, cash, POS) and an
  optional reference. Part-payments are fine; you can't pay more than the
  balance. The invoice turns *Paid* when it's covered.
- **Undo payments** (admin) — removes an invoice's payments if one was
  recorded by mistake.

Below the table: **Receivables** (all outstanding balances) and **Collected
this month** (payments received this month, by the date they arrived).

### Batches

Each flock as a card: breed, supplier, **birds now** (placed − deaths),
mortality, house, date received.

- **New batch** — placed today, into a house with room (or unassigned).
- **Record deaths** — adds to the batch's mortality; can't exceed the birds
  left.
- **Close batch** — when the flock is sold off or depopulated. It leaves its
  house and stops counting as birds in lay.

### Houses

Each house shows how full it is: birds in it (from active batches), the batch
in it, and utilisation against capacity. Nothing is stored on the house — it's
all worked out from the batches.

Admins can *Edit* a house's capacity, but not below the birds already in it.

### Feed

Layers' own feed position.

- **Feed stock** = external deliveries + feed from the mill − feed used.
- **Used today** — kg logged today across all houses.
- **Days cover** — stock ÷ average daily use over the last 7 days.
- **From mill** — feed the Feed Mill issued to Layers (as an internal sale or
  by fulfilling a Layers feed request). It arrives here on its own — don't
  re-enter it.

Record **feed used** per house in the bar at the top; **Record delivery** for
feed bought from outside suppliers.

### Health

- **Record vaccination** — vaccine (from the central store), batch, house (the
  batch's house by default), route, and either *Given today* with the quantity
  used, or *Scheduled (due)*. A dose given takes that quantity out of the
  **layers** store location; it's refused if Layers doesn't have enough — move
  some from the store first (*Inventory → Record movement*).
- **Record medication** — drug, reason, batch, quantity used, dosage. Draws from
  the layers location the same way.
- Deleting a health record (admin) puts its doses back.

### Water

Metering only — litres per house per day. **Used today** and **Daily average**
across logged days. Not stock; nothing draws it down.

---

## 5. How the figures are worked out

Nothing is typed in as a total — every figure is calculated from the entries,
so it's always consistent.

| Figure | Formula |
| --- | --- |
| Good eggs | total − cracked − rejects |
| Eggs collected today | Σ today's production entries |
| Birds in lay | Σ over active batches of (birds placed − deaths) |
| Lay rate | eggs today ÷ birds in lay |
| Crates in store | crates graded in − non-sale outs − crates sold (crate invoices) |
| House occupancy | birds in active batches in the house ÷ capacity |
| Layers feed stock | external deliveries + mill transfers to Layers − feed used |
| Days of feed cover | stock ÷ average daily use over the last 7 days |
| Allocation used | Σ this week's orders that aren't declined |
| Invoice balance | qty × price − payments |
| Blocking debt | Σ balances of the buyer's unpaid invoices dated before this Monday |
| Collected this month | Σ payments received this month |

Weeks run Monday–Sunday and "today" is the date in Lagos.

---

## 6. An egg order, start to finish

```
 Buyer orders in portal ─┐
                         ├─► Pending ──► Fulfil ──► Invoice (Pending) ──► Payments ──► Paid
 Staff: Order for buyer ─┘        │                     │
                                  └─► Decline           └─ unpaid past Monday ─► Debt hold
```

1. The buyer (or staff for them) places an order — checked against the weekly
   allocation and the debt hold. Admins get an email if email is set up.
2. It appears on **Egg orders** and the waiting counts go up.
3. Staff **fulfil** it → an invoice at today's crate price; crates leave the
   store. The buyer sees the invoice in their portal.
4. The buyer pays (bank transfer); an admin **records the payment**. Part-
   payments reduce the balance.
5. If an invoice is still unpaid when a new week starts, the buyer is on
   **debt hold** — no new orders, and their pending orders can't be fulfilled —
   until it's paid.

---

## 7. What a buyer sees (portal)

At `/portal`, each buyer sees only their own business:

- This week's allocation left, the crate price, and whether their account is
  clear or on hold (and for how much).
- **Place an order** — crates and an optional note (e.g. delivery instructions).
- Their orders with status and notes, and their invoices with amount, balance
  and a printable copy.
- *Change password* in the header.

---

## 8. Corrections

Mistakes are fixed by an **admin**:

- **Delete** on a row removes a wrong entry; then re-enter it correctly. A
  delete is refused if it would leave stock below zero (e.g. deleting crates
  graded in that have since been sold).
- Deleting an order's invoice puts the order back to *Pending*. An invoice with
  payments can't be deleted until the payments are undone.
- **Edit** changes a house's capacity or a buyer's details and weekly
  allocation.
- Everything is recorded on **Activity** — who did what, when, and a copy of
  anything deleted.

---

## 9. Messages you might see

| Message | What it means / what to do |
| --- | --- |
| *Add a house first.* | No houses yet — create one under **Houses**. |
| *H-01 is full* / *only has room for N more birds* | Pick another house, or edit the capacity (admin). |
| *Cracked + rejects can't exceed total eggs.* | Check the numbers entered. |
| *No crates in stock. Record graded crates under Egg inventory first.* | Grade crates **in** before selling or fulfilling. |
| *Only N crates in stock.* | Fulfil or sell less, or grade more crates in. |
| *Set the crate price first.* | Admin: *Change* next to the crate price on Egg orders. |
| *On debt hold: ₦X unpaid from previous weeks.* | The buyer must pay old invoices before ordering again. |
| *Only N crates left on this week's allocation.* | Order less, or wait until Monday (or raise their allocation — admin). |
| *No [vaccine] at Layers. Move some there from the store first.* | Inventory → Record movement: store → layers. |
| *Only an admin can do that.* | Ask an admin. |

---

## 10. Glossary

- **Batch** — one flock placed at one time.
- **Grading in** — packing collected eggs into crates and putting them in store.
- **Non-sale out** — crates leaving store without a sale (breakage, spoilage,
  farm use).
- **Allocation** — the most crates a buyer may order in a week.
- **Debt hold** — the block on a buyer with unpaid invoices from earlier weeks.
- **Receivables** — everything buyers still owe.
- **Mill transfer** — feed the Feed Mill issues to Layers.
