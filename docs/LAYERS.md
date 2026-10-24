# Layers division — walkthrough

How the Layers side of the Argandu ERP works: what each screen is for, the
order you use them in during a normal day, how every figure is worked out,
and the rules the app enforces. Everything here is under **Layers** in the
sidebar.

---

## 1. The screens at a glance

| Screen | What it's for | Who records it |
| --- | --- | --- |
| **Overview** | Today's eggs, lay rate, eggs in store, orders waiting, what needs attention, eggs-vs-feed chart | — (read only) |
| **Production** | Each house's daily egg collection | Staff |
| **Egg inventory** | Crates graded into the store, and non-sale outs (breakage, spoilage, use) | Staff · large write-offs and opening stock: admin |
| **Egg orders** | Buyers' orders (portal or placed for them), fulfil (all or part) or decline | Staff · crate price: admin |
| **Sales & invoices** | Every sale (crates, spent hens), invoices, payments | Staff record sales · admin records payments |
| **Batches** | Flocks placed, birds in lay, birds out (died, culled, sold), moving and closing a flock | Staff |
| **Houses** | Houses and their capacity, occupancy | Staff add · admin edits capacity |
| **Feed** | Feed bought in (with its cost), feed from the mill, feed used per house | Staff |
| **Health** | Vaccinations and medication, drawn from the store; withdrawal periods | Staff |
| **Water** | Litres per house per day | Staff |

Anything waiting for you shows as a green count — on **Egg orders** in the
sidebar, on the bell in the top bar, and in the browser tab title. The
**Overview** also lists what needs attention: expired orders, write-offs
waiting for approval, overdue doses, houses under withdrawal and eggs left
ungraded.

**Roles.** Staff record day-to-day work. Admins can also set the crate price
and weekly allocations, **record or undo payments and advances**, approve
large write-offs, record opening stock, edit catalogue details (house
capacity, buyers) and delete wrong entries. See [Corrections](#8-corrections).
The **owner** (the farm's first admin) is the only one who can add admins,
change an admin's role or remove their access; no one can change the owner.

---

## 2. Setting up Layers (first time)

Do these once, in this order — each step needs the one before it.

1. **Houses** → *New house*: code (e.g. `H-01`) and capacity in birds.
2. **Batches** → *New batch*: batch number, breed, supplier, number of birds,
   the house, the **date it arrived** (can be in the past) and the date it
   **started laying** (leave empty for pullets — see [Batches](#batches)). A
   house can't be filled past its capacity; you can also place a batch with
   *Not in a house yet*.
3. **Inventory** (Across the farm) → add the vaccines and drugs you use, with
   their **egg withdrawal days** and **expiry date** where they have one.
   Record a receipt into the **store**, then move what Layers needs from the
   store to **layers**. Health records draw from the *layers* location.
4. **Egg orders** → *Change* next to *Crate price* (admin) to set the price per
   crate. Orders can't be fulfilled until a price is set.
5. **Egg inventory** → an admin records the crates already on the shelf as
   **Opening stock**. It's the only way to add crates that weren't collected
   through the app.
6. **Customers** (Across the farm) → add each buyer and invite them to the
   portal (give an email when adding them, or use *Invite* on their row). An
   **admin** sets each buyer's **weekly crate allocation** — a buyer added by
   staff starts at 0 and can't order until an admin sets it.

---

## 3. A normal day

```
 Morning                  Through the day                 Evening / as needed
 ───────                  ───────────────                 ───────────────────
 Production (per house) → Egg inventory: grade crates in → Egg orders: fulfil / decline
 Water (per house)        Feed: log use per house           Sales: record walk-in sales
 Health (doses due)       Batches: record birds out         Sales: record payments (admin)
```

1. **Collect and record eggs** — *Production*: pick the house, enter total eggs,
   cracked and rejects, *Record today's collection*. Do it for each house.
   Several collections a day are fine; they add up.
2. **Grade into crates** — *Egg inventory*: choose **In — graded from
   collections** and the number of crates. This is what puts crates on the
   shelf; production on its own does not. You can't grade more crates than the
   good eggs collected allow.
3. **Log water and feed** — *Water* and *Feed*: litres and kg per house.
4. **Record birds out** — *Batches* → *Birds out* on the batch: how many, and
   whether they **died** or were **culled**. (Spent hens sold go through *Record
   sale*, which takes them off the batch too.)
5. **Health** — *Give* any scheduled dose that's due, or record a vaccination
   or treatment given (it takes the doses out of the Layers store).
6. **Work the orders** — *Egg orders*: fulfil what you can supply (all of an
   order or part of it); decline what you can't.
7. **Money** — *Sales & invoices*: record walk-in sales; an admin records
   payments as they arrive, including walk-in cash.

### Catching up on a day you missed

Every day-to-day record has a **Date**, set to today. Pick an earlier day to
record something that was missed — the date box turns amber and the button
says which day you're recording for.

- **Which records:** production, grading and write-offs, feed used, feed
  deliveries, water, birds out, vaccinations, medication and *Give*, sales,
  payments and advances, and on the mill side ingredient deliveries,
  production runs, feed sales and inventory movements.
- **How far back:** staff can go up to **7 days**; admins can pick any past
  day. Nobody can record for a future day.
- **The rules follow the chosen day.** A backdated sale to a buyer counts
  against *that* week's allocation and checks debt from before that week; a
  drug's withdrawal runs from the day it was given; a collection is withheld
  only if a withdrawal covered that day; an item is refused if it had expired
  by then. A payment can't be dated before its invoice, and birds can't leave
  a batch before it arrived.
- **Stock checks use what's on hand now**, so grading, write-offs and sales
  can't take more than the store holds today.
- **Activity** shows backdated entries with *for [date]*, next to when they
  were actually entered.
- Orders, fulfilment and feed requests are always today — they're about
  this week's allocation and stock.
- A dose recorded late doesn't change collections already recorded for the
  days it covers; check those houses' eggs if a withdrawal applied.

---

## 4. Screen by screen

### Overview

Four figures, a to-do list and a chart:

- **Eggs collected today** (the dark tile) — sum of today's production entries.
- **Lay rate** — today's eggs ÷ birds in lay. Only batches marked *in lay* by
  today count, so a house of pullets doesn't drag the rate down. Shows "—"
  when no birds are in lay.
- **Eggs in store** — crates on hand (see [how stock is worked out](#5-how-the-figures-are-worked-out)).
- **Orders waiting** — pending egg orders from this week.

**Needs attention** lists, with a link to each screen: orders from an earlier
week that have expired, write-offs waiting for an admin, overdue doses, houses
whose eggs are withheld, and ungraded eggs piling up (more than two days'
laying).

**Eggs vs feed — daily** shows the last 7 calendar days: eggs collected on
top, feed used underneath, on the same days. A gap means nothing was logged
that day. When the feed line moves and the egg line doesn't follow, look into
it. *Table* switches to the numbers, including grams of feed per bird.

Below: the latest collections and pending portal orders.

### Production

- Fields: **House**, **Total eggs**, **Cracked**, **Rejects**.
- Rules: total eggs must be a whole number above 0; cracked + rejects can't be
  more than the total.
- **Withdrawal.** If a house is in a drug withdrawal period (see
  [Health](#health)), its good eggs are recorded as **withheld**. They can't
  be graded into crates or sold. The form warns you before you record, and the
  row shows how many were withheld.
- Table: date, house, total, cracked, rejects, withheld, **good eggs** (total
  − cracked − rejects − withheld).
- The house list is your real houses; with none set up, the form says *Add a
  house first*.

### Egg inventory

The crate ledger. Three kinds of movement:

- **In — graded from collections**: crates packed and put on the shelf. You
  can't grade more crates than the good eggs collected (and not yet graded)
  allow, at the farm's **eggs per crate** (30 unless changed).
- **Out — not a sale**: breakage, spoilage, farm use or another reason you
  type. A reason is required.
- **Opening stock** (admin): crates already on the shelf at go-live. They
  don't count against collected eggs.

Sales are **not** recorded here — a crate invoice takes crates out on its own.
An *out* can't take more crates than are in store.

**Write-off approval.** A small write-off by staff counts straight away. A
**large** one — more than 5 crates **and** more than 5% of the crates in store
— waits for an admin. Admins get an email (if email is set up) and see it in
*Write-offs waiting for approval* with **Approve** and **Reject**. Stock only
goes down when it's approved. Write-offs an admin records count straight away.

Figures:

- **In stock** — crates on hand.
- **Eggs not yet graded** — good eggs collected but not yet packed. It turns
  red when it's more than two days' laying; check collections against crates.
- **Sold** — crates on invoices.
- **Written off** — approved non-sale outs, and their share of crates graded
  in (red above 3%).

### Egg orders

**Orders are paid for up front.** A buyer pays when they order — online on
Paystack, or from their credit — and only paid orders reach the farm. The
farm never sends crates that haven't been paid for.

One list for orders from the **buyer portal** and orders staff place for a
buyer (*Order for buyer*). Paid orders waiting to be fulfilled are at the
top; the sidebar, bell and tab title count only those.

Each row shows the buyer, crates, the **price locked on the order**, how much
of their weekly allocation is used, the status, and the buyer's note if they
left one. Statuses:

- **Paid · to fulfil** — the buyer has paid; fulfil it.
- **Awaiting payment** — not paid yet, with the time it's released if still
  unpaid. It can't be fulfilled.
- **Fulfilled** — with whether the buyer has confirmed the crates arrived.
- **Declined** — with why: not paid in time, cancelled by the buyer, or
  declined by the farm.

**Rules — the same in the portal and for staff:**

1. **Weekly allocation.** A buyer can order up to their weekly crates across
   the week (Monday–Sunday, Lagos time). Declined orders don't count. A buyer
   with no allocation (0) can't order.
2. **Pay first.** The order is paid when it's placed: the buyer's free credit
   is used first, and they pay the rest on Paystack. An unpaid order **holds
   its crates for 24 hours**, then it's released and the crates go back on
   the allocation.
3. **Debt hold.** If a buyer has an unpaid invoice from **before this week**
   (from before pay-first, or a counter sale), they can't order until it's
   paid. The row shows *Debt hold — ₦amount*.
4. **Price lock.** An order keeps the crate price from the moment it's
   placed. Changing the crate price doesn't change orders already placed.

**Actions:**

- **Fulfil → invoice** (paid orders) — checks there are enough crates in
  store, marks it fulfilled and raises the invoice at the locked price,
  settled from what the buyer paid. All of it happens together or not at all.
- **Fulfil part** — in the *Fulfil order* drawer, enter fewer *Crates to
  send* than ordered. Those are invoiced now; the rest stays pending — still
  paid for — until you have the stock.
- **Mark paid** (admin, unpaid orders) — when the buyer paid by bank
  transfer, cash or POS instead of online. Only use it once the money is in
  the farm's account; the order then joins the queue.
- **Decline** — the order stops counting against the allocation. If it was
  paid for, the money stays as the buyer's **credit** for their next order
  (an admin can refund it from Customers).

**Crate price** (admin) — *Change* next to the price. Applies to orders placed
from then on. Buyers can't order until a price is set.

### Sales & invoices

Every sale in one table: date, customer, product, quantity, unit price,
amount, **balance** still owed, status (*Pending*, *Part-paid*, *Paid*).

- **Record sale** — the customer, the product and the quantity.
  - **Crates to a registered buyer** go through the same checks as an order —
    allocation, debt hold and stock — and are recorded as an order fulfilled on
    the spot, at the crate price. Only an admin can sell at another price.
  - **Walk-ins pay cash.** Choose *Walk-in* and enter a name. The invoice waits
    in **Cash to confirm** until an admin records the money. Walk-ins can't
    hold credit or debt.
  - **Spent hens**: choose the **batch** they came from and the price per
    bird. The birds come off the batch as *sold*.
  - *Money received now* (admin only) records the payment with the sale.
- **Invoice** — opens a printable invoice (print or *Save as PDF*). With email
  set up, staff can *Email to buyer*.
- **Record payment** (admin) — see below.

Below the table: **Receivables** (all outstanding balances), **Cash to
confirm** (walk-in sales not yet confirmed) and **Collected this month**.

### Money: payments, credit and advances

Only an **admin** records money by hand. Buyers can also **pay online** in
the portal, and that money is recorded on its own (see below).

- **Record payment** — amount, method (transfer, cash, POS) and an optional
  reference. Part-payments are fine. If a registered buyer pays **more** than
  the balance, the invoice is paid and the extra is kept as their **credit**.
  A walk-in can't pay more than the balance.
- **Record advance** — *Customers* → *+ advance* on the buyer's row, for money
  paid before there's an invoice. It all becomes credit, and anything they
  already owe is settled from it straight away, oldest invoice first.
- **Refund** — *Customers* → *refund* next to the buyer's credit (admin), for
  money paid back to them (e.g. a paid order the farm couldn't fill). Send the
  money first, then record it. Credit holding a paid order that hasn't been
  fulfilled can't be refunded — decline the order first.
- **Credit is used automatically** on the buyer's next invoices (shown as a
  payment *From credit*). The buyer sees their credit in the portal.
- **Remove a payment** — open an invoice's payments and press *Remove* next to
  the wrong one (admin). The invoice
  goes back to owing if what's left no longer covers it. Removing a *From
  credit* payment gives the credit back. Admins get an email when a payment is
  removed.
- **Paid online (Paystack)** — a buyer presses *Pay now* on an unpaid invoice
  in the portal and pays on Paystack's page (card, bank transfer or USSD). The
  app asks Paystack to confirm the payment before recording anything, then
  records it on the invoice as *Paystack (online)* with the Paystack
  reference, and admins get an email. If the invoice was already paid
  another way by the time the money arrives, the whole amount becomes the
  buyer's credit, so nothing paid is lost. It shows on Activity as done by
  *Paystack*.

### Batches

Each flock as a card: breed, supplier, **birds now** (placed − birds out),
**birds out** split into died, culled and sold, house, date received and
whether it's in lay.

- **New batch** — with the date it arrived (today or earlier) and, if it's
  already laying, the date it started. Into a house with room, or unassigned.
- **Mark in lay** — the date the flock started laying (not before it arrived,
  not in the future). From then its birds count toward the lay rate.
- **Birds out** — how many and why: **died** or **culled**. Can't exceed the
  birds left. Spent hens **sold** are recorded through *Record sale*.
- **Move** — moves the whole batch to another house with room, or out of a
  house.
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
- **Feed cost per crate** — feed used this month × the average cost per kg of
  all feed Layers has received ÷ crates graded in this month.
- **From mill** — feed the Feed Mill issued to Layers (as an internal sale or
  by fulfilling a Layers feed request), at the mill's price. It arrives here on
  its own — don't re-enter it.

Record **feed used** per house (and the day) in the bar at the top — you **can't log more
than the feed Layers has**. **Record delivery** for feed bought from outside
suppliers: supplier, kg and **price per kg**.

### Health

- **Record vaccination** — vaccine (from the central store), batch, house (the
  batch's house by default), route, and either:
  - **Given today** with the quantity used — it's taken out of the **layers**
    store location, and refused if Layers doesn't have enough (move some from
    the store first: *Inventory → Record movement*); or
  - **Scheduled** with the date it's due. Nothing is drawn yet. It turns
    *overdue* after its date. When it's done, press **Give** on the row and
    enter the quantity used — it's dated today and draws the stock then.
- **Record medication** — drug, reason, batch, quantity used, dosage. Draws from
  the layers location the same way.
- **Expiry.** An item past its expiry date can't be given; the store shows it
  as *expired*.
- **Withdrawal.** If the item has egg withdrawal days, giving it starts a
  withdrawal period on that house. Until it ends, the house's good eggs are
  **withheld** at collection (see [Production](#production)). The row shows
  *eggs withheld to [date]*, and the house is listed on the Overview.
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
| Good eggs | total − cracked − rejects − withheld |
| Eggs collected today | Σ today's production entries |
| Birds in lay | Σ over active batches in lay by today of (birds placed − birds out) |
| Lay rate | eggs today ÷ birds in lay |
| Crates in store | approved crates in (graded + opening stock) − approved outs − crates sold |
| Eggs not yet graded | Σ good eggs − crates graded from collections × eggs per crate |
| Write-off share | approved outs ÷ crates graded in |
| House occupancy | birds in active batches in the house ÷ capacity |
| Layers feed stock | external deliveries + mill transfers to Layers − feed used |
| Days of feed cover | stock ÷ average daily use over the last 7 days |
| Feed cost per crate | feed used × average cost per kg received ÷ crates graded in |
| Allocation used | Σ this week's orders that aren't declined |
| Invoice balance | qty × price − payments (including *From credit*) |
| Buyer credit | advances + overpayments − credit used |
| Blocking debt | Σ balances of the buyer's unpaid invoices dated before this Monday |
| Receivables ageing | outstanding balances by invoice age: up to 7, 8–30, 31–60, over 60 days |
| Collected this month | Σ payments received this month |

Weeks run Monday–Sunday and "today" is the date in Lagos.

---

## 6. An egg order, start to finish

```
 Buyer: New order ──► Pay now (Paystack, or from credit) ──► Paid ──► Fulfil (all or part) ──► On its way ──► Received
 Staff: Order for buyer ─► buyer emailed to pay ─┘    │            │
                                                     │            └─► Decline ─► the money stays as their credit
                                                     └─ not paid in 24 hours ─► Released (crates back)
```

1. The buyer picks how many crates — checked against the weekly allocation
   (and any old unpaid invoice). Today's crate price is locked on it.
2. They **pay straight away**: their free credit first, the rest on Paystack.
   (Staff can order for a buyer; the buyer is emailed a link to pay, or an
   admin uses **Mark paid** for a transfer.) Unpaid, it holds the crates for
   24 hours and is then released.
3. Once it's paid, the order appears on **Egg orders** as *Paid · to fulfil*,
   the waiting counts go up, and admins get an email. The buyer gets an
   "order confirmed" email.
4. Staff **fulfil** it — all of it, or part with the rest left paid and
   pending. The invoice is raised and settled from the payment; crates leave
   the store; the buyer is emailed that it's on its way.
5. When the crates arrive, the buyer presses **Mark received** in the portal.
6. If the farm declines a paid order (or the part it can't supply), the money
   stays as the buyer's credit and pays for their next order — or an admin
   refunds it.

---

## 7. What a buyer sees (portal)

At `/portal`, each buyer gets their own dashboard — the same look as the
ERP, with a sidebar of **Dashboard**, **Orders** and **Payments**, and
*Change password* / *Sign out* under Account. They only ever see their own
business.

- **Dashboard** — crates left this week, the crate price (locked in when they
  order), what they owe (red when something is overdue) and their credit;
  **Place an order**; their unpaid invoices with **Pay now**; and their latest
  orders. If last week's balance is unpaid, a red bar says ordering is paused,
  with a button to pay.
- **Orders** — **New order**: pick eggs, set the crates (only up to what's
  left this week), see the total, what their credit covers and what's left to
  pay, then **Pay** on Paystack. Below: what's awaiting payment (with **Pay
  now** and **Cancel**), what's paid and with the farm, orders to confirm, and
  every order with its locked price, total, status and invoice. A fulfilled
  order has **Mark received**. The sidebar counts orders awaiting payment.
- **Payments** — outstanding, overdue, paid this month and credit; every
  invoice with what's been paid and the balance, **Pay now** on unpaid ones
  (when online payment is switched on) and a printable copy; every payment
  with its method and reference; and their credit account (money in, credit
  used). The sidebar counts unpaid invoices. After paying online they come
  back here with a message: paid, still being confirmed, or didn't go through.
  Paying last week's balance online lifts the debt hold straight away.

---

## 8. Corrections

Mistakes are fixed by an **admin**:

- **Delete** on a row removes a wrong entry; then re-enter it correctly. A
  delete is refused if it would leave stock below zero (e.g. deleting crates
  graded in that have since been sold).
- Deleting an order's invoice puts the order back to *Pending*. An invoice with
  payments can't be deleted until the payments are removed. Deleting a spent-
  hen invoice puts the birds back on the batch. Admins get an email when an
  invoice is deleted.
- **Edit** changes a house's capacity, a buyer's details and weekly
  allocation, or an inventory item's details.
- Everything is recorded on **Activity** — who did what, when, a copy of
  anything deleted, and the **old and new values** of anything edited.

---

## 9. Messages you might see

| Message | What it means / what to do |
| --- | --- |
| *Add a house first.* | No houses yet — create one under **Houses**. |
| *H-01 is full* / *only has room for N more birds* | Pick another house, or edit the capacity (admin). |
| *Cracked + rejects can't exceed eggs collected.* | Check the numbers entered. |
| *No ungraded eggs to pack* / *Only N crates' worth of eggs are ungraded* | Record the collections under **Production** first, or grade fewer crates. |
| *Give a reason for crates leaving without a sale.* | Pick or type a reason. |
| *No crates in stock. Record graded crates under Egg inventory first.* | Grade crates **in** before selling or fulfilling. |
| *Only N crates in stock.* | Fulfil part of the order, sell less, or grade more crates in. |
| *Set the crate price first.* | Admin: *Change* next to the crate price on Egg orders. |
| *On debt hold: ₦X unpaid from previous weeks.* | The buyer must pay old invoices before ordering again. |
| *Only N crates left on [buyer]'s allocation this week.* | Order less, or wait until Monday (or raise their allocation — admin). |
| *[Buyer] has no weekly allocation yet* | An admin sets it on **Customers** → *Edit*. |
| *This order is from an earlier week and has expired — decline it.* | The buyer orders again this week. |
| *Only an admin can record a payment.* | Walk-in cash waits in *Cash to confirm* for an admin. |
| *…walk-ins can't hold credit.* | Record no more than the balance for a walk-in. |
| *Only N kg of feed on hand.* | Record the delivery or mill transfer first, or check the kg. |
| *Laying can't start before the flock arrived.* | Check the dates. |
| *[Item] expired on [date] — don't use it.* | Use another stock; update or remove the expired item. |
| *No [vaccine] at Layers. Move some there from the store first.* | Inventory → Record movement: store → layers. |
| *Staff can record up to 7 days back — ask an admin for anything older.* | An admin enters it. |
| *You can't record for a future date.* | Pick today or an earlier day. |
| *The invoice is dated … — a payment can't be earlier.* | Check the date the money arrived. |
| *[Batch] hadn't arrived by then.* | Check the date, or the batch's arrival date. |
| *Only an admin can do that.* | Ask an admin. |

---

## 10. Glossary

- **Batch** — one flock placed at one time.
- **In lay** — a batch that has started laying; only these count toward the
  lay rate.
- **Birds out** — birds leaving a batch: died, culled or sold.
- **Grading in** — packing collected eggs into crates and putting them in store.
- **Ungraded eggs** — good eggs collected but not yet packed into crates.
- **Opening stock** — crates already on the shelf when the app went live.
- **Non-sale out / write-off** — crates leaving store without a sale
  (breakage, spoilage, farm use).
- **Allocation** — the most crates a buyer may order in a week.
- **Price lock** — an order keeps the crate price from when it was placed.
- **Expired order** — an order not fulfilled in the week it was placed.
- **Debt hold** — the block on a buyer with unpaid invoices from earlier weeks.
- **Credit** — money a buyer paid in advance or over an invoice, used on their
  next invoices.
- **Withdrawal period** — days after a drug when eggs mustn't be sold; the
  house's eggs are withheld.
- **Receivables** — everything buyers still owe.
- **Mill transfer** — feed the Feed Mill issues to Layers.
