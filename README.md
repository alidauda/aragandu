# AFEMS web — Farm ERP + buyer portal

Next.js 16 (App Router) on Postgres via Prisma 7, with Better Auth for sign-in.

- **ERP** (`/`, staff only): layers, feed mill, inventory, customers. Screens read
  ledgers loaded by `src/app/(erp)/layout.tsx`; writes are server actions in
  `src/lib/erp/actions.ts`.
- **Buyer portal** (`/portal`, customer logins): place egg orders within the weekly
  allocation; the debt gate blocks ordering while a previous week's invoice is unpaid.
  Both rules are enforced on the server in `src/lib/egg-orders.ts`.

## Setup

```bash
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install                   # also generates the Prisma client
npm run db:migrate            # create/upgrade the schema
npm run dev
```

### Local demo data

`npm run db:seed` loads the demo farm into an **empty** database (it refuses if any
customer exists) and creates two logins:

| Role  | Email                | Password           |
| ----- | -------------------- | ------------------ |
| Staff | `staff@argandu.test` | `afems-staff-demo` |
| Buyer | `buyer@argandu.test` | `afems-buyer-demo` |

### Accounts and roles

There is no public sign-up. Accounts come from **invite links**: an admin creates one and
it's emailed to the person (or copied and sent however you like — WhatsApp, SMS). The person opens it,
chooses their own password and is signed in. Links work once and expire after 7 days;
only a hash of each link is stored.

**Roles.** A team member can hold several roles at once — e.g. *Layers admin + Sales*, or
*Feed mill staff + Store keeper* — and gets the most any of them allows. Set them on invite or
with **Team → Edit roles**.

| Role | Gives |
| ---- | ----- |
| Owner | Everything, plus managing admins. The first admin is the owner; no one can change or lock out the owner |
| Whole farm admin / staff | Every division at that level and the farm dashboard. Farm-wide admins also see Activity and the Email log; farm-wide staff only see money |
| Division admin / staff (Layers, Feed mill, Broilers, Ruminants) | That division's work only. Admins also do its money and corrections and manage its staff |
| Sales | Buyers, egg orders and sales, feed sales and invoices across every division; sees payments but can't record them |
| Accounts | Money across the farm — record and undo payments, advances, refunds — sees every sale, and every report |
| Store keeper | Inventory at every location: receipts, moves and the catalogue |
| Reports viewer | Every report, read-only |
| Buyer | The buyer portal for their own business |

Who can give what: the owner gives any role; farm-wide admins give any staff-level role
(Sales, Accounts, …); a division admin gives staff roles in the divisions they run. Admin roles
are the owner's to give.

What each division sees:

| Division | Pages |
| -------- | ----- |
| Layers | Layers, Customers (egg buyers), egg orders and sales, Feed requests, Inventory at the layers store, Reports, Team |
| Feed mill | Feed mill (including answering feed requests and feed sales), Inventory at the mill, Reports, Team |
| Broilers / Ruminants | Feed requests, Inventory at their store, Team |

The server enforces it: people only receive the data their roles cover, and any action
outside them is refused.
- **Buyers:** ERP → **Customers** → Invite on the buyer's row, or give an email when adding them. Admins can remove a buyer's portal access there.
- **Removing a buyer:** Customers → *Remove* beside the name (admins). A buyer with no orders,
  invoices or payments is deleted completely, with their login and invites. A buyer with history
  is **archived** instead: hidden from lists and pickers, portal login turned off, unpaid orders
  released — every invoice and payment stays, as does anything they still owe (a buyer with paid
  orders waiting must have those fulfilled or declined first). *Show removed* lists them; *Restore*
  brings them back (turn their portal login back on separately).
- **A former buyer joining the team:** once their portal access is removed (or the buyer is
  removed), invite the same email from **Team** — accepting turns their old login into a team
  login with the new password and roles. Their buyer's records stay with the buyer.
- **Walk-in buyers:** Customers → **Walk-in buyers** — local buyers who aren't on the register.
  *Sell to walk-in* by name (no account), see what each has bought and what's still to be
  confirmed, and *Add to register* when someone becomes a regular.
- **The very first admin** (before anyone can sign in):
  `npm run user:create -- --email ada@argandu.farm --name "Ada Okafor"` (prompts for the password).
- Everyone can change their own password (sidebar → Password; portal → Change password).
- **Forgotten passwords:** *Forgot password?* on both sign-in pages emails a one-hour link. If
  the email service refuses it, the page says so (the reason is in the **Email log**). An admin
  can also make the link by hand — **reset link** on the person's row in Team, or beside a
  buyer's portal login in Customers — and send it on WhatsApp. Or **set password** there to type
  a new one for them: they're signed out everywhere and emailed that it changed, and the password
  is never written to Activity. Both follow the same rule as removing someone's access (owner for
  admins, farm admins for staff, division admins for their own staff, admins for buyers).

### When things were recorded

Every record keeps the moment it was entered, alongside the day it's for. Tables show it
under the date: *recorded 14:32* when entered the same day, and **entered 25 Oct, 14:32** in
amber when it was recorded for an earlier day, so late entries stand out (hover for the full
time). Orders show when they were *placed*; buyers, ingredients, products, houses, batches and
store items show when they were *added*. The Excel report and the payments CSV have a
*Recorded* column. Who made each change is in **Activity**.

### Corrections

Catalogs (buyers, ingredients, products, houses, store items) are edited in place by an
admin. Ledger entries (production, sales, deliveries, runs, moves, health records…) are
**deleted and re-entered** — an admin's Delete button on each row. A delete is refused
when it would leave stock below zero (e.g. a delivery that's already been mixed), and
deleting an order's invoice or a request's sale puts the order/request back to pending.

### Payments, invoices and reports

- **Payments:** an admin records money received against an invoice (Sales → Record payment) —
  part or whole, by transfer, cash or POS. The invoice is paid once its payments cover it;
  the debt hold, receivables and "collected" all use the outstanding balance.
- **Invoices:** every invoice has a printable page (Sales → Invoice; buyers open theirs from
  the portal). Use the browser's Print → Save as PDF.
- **Settings (owner and farm-wide admins):** ERP → **Settings**.
  - **Payments** — **Online (Paystack)** needs nothing else: Paystack takes the money (it needs
    `PAYSTACK_SECRET_KEY` on the server). **Manual** turns online checkout off and asks for the
    account buyers pay into — bank, account name and 10-digit account number — plus an optional
    note. Buyers see it in the portal (with a copy button for the account number) and in their
    order emails; staff then **Mark paid** on Egg orders and record invoice payments on Sales.
    Unpaid orders are still released after 24 hours.
  - **Eggs** — the farm's crate price (also on Egg orders).
- **Payment receipts:** paying outside the app, a buyer uploads their transfer receipt (photo,
  screenshot or PDF, up to 5 MB) on an unpaid order or invoice in the portal, with the amount
  and reference. Staff see *Receipt sent · ₦… · view* on Egg orders and Sales; **Mark paid** /
  **Record payment** shows every receipt, fills in the reference, and accepts it, or *Not
  accepted…* sends the buyer the reason so they can upload another. The receipt stays on the
  order and its invoice. Admins can upload a receipt for any buyer (*upload receipt* on the
  row); sales staff only for buyers an admin allows (Customers → Edit → *Sales staff can upload
  payment receipts*). Files are kept in the database for now — `src/lib/proofs.ts` is the one
  place that stores and reads them.
- **Payments page:** ERP → **Payments** — every naira in and out for any period:
  invoice payments, orders paid up front, advances, overpayments and refunds, with totals by
  method (transfer, cash, POS, Paystack), filters, a CSV download, and online checkouts that
  weren't completed.
- **Full report:** ERP → **Reports** → *Full report* — pick a period (this month, last month,
  quarter, year, last 30 days, all time or custom). **Open report** gives a printable document
  (Print → Save as PDF) with a summary and sections for sales, orders, money (payments,
  ageing, debtors), egg production, the egg store, flock, layers feed & water, health, the
  feed mill, feed requests and inventory. **Download Excel** gives the same report as a
  workbook: a Summary sheet plus one sheet per table, with real ₦/number/date cells. Both
  come from one builder (`src/lib/reports/farm-report.ts`) and are cut to the viewer's
  division. The monthly sections with CSV downloads are still below it.
- **Activity (admins):** the audit log — every change, who made it and when; deletes keep a
  copy of what was removed.
- **Alerts:** pending orders and requests show as counts in the sidebar and tab title; the
  ERP checks every minute and can pop a browser notification for new orders.

### Email (optional)

Set `EMAIL_FROM` (a sender on your verified domain, e.g.
`Argandu Farms <noreply@argandufarms.com.ng>`) and one provider key:

- `ZOHO_EMAIL_API_KEY` — Zoho CPaaS / ZeptoMail: the agent's API key, `Zoho-enczapikey …`
  (Agents → your agent → SMTP/API). Used first when set.
- `RESEND_API_KEY` — [Resend](https://resend.com).

That turns on (all templates live in `src/lib/mail.ts`):

- **Accounts:** invite links go out as soon as they're created; *Forgot password?* on both
  sign-in pages emails a one-hour reset link; a notice whenever a password is changed or reset.
- **Buyers:** order received, order fulfilled (with the invoice and what's due), order not
  fulfilled, counter-sale invoices, and a receipt for every payment, advance or online payment.
- **Admins:** new orders, online payments, write-offs waiting for approval, removed payments
  and deleted invoices.

Emails are sent after the page responds, so a slow or failing email service never blocks a
save. Every attempt is recorded in the **Email log** (admin, in the sidebar): who it went to,
what it was, and whether the provider accepted it — with the provider's reason when it didn't. Without a key none of this is sent, invite links are copied by hand, and *Forgot
password?* says to ask the farm for a new invite.

## Scripts

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run db:migrate` | Create and apply migrations (development)    |
| `npm run db:deploy`  | Apply pending migrations (production)        |
| `npm run db:seed`    | Load demo data into an empty database        |
| `npm run user:create`| Create a staff or customer login             |

The farm's calendar ("today", the Monday week start) is computed in Africa/Lagos —
see `src/lib/dates.ts`.

## Deploying on Railway

`railway.json` builds with `npm run build`, runs `npm run db:deploy` (Prisma
`migrate deploy`) as the **pre-deploy command**, then starts `npm run start`. If
a migration fails, the deploy is aborted and the previous version keeps serving.

1. Add a **PostgreSQL** service to the project, and a service from this GitHub repo.
2. On the app service, set the variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `BETTER_AUTH_SECRET` = output of `openssl rand -base64 32`
   - `BETTER_AUTH_URL` = the service's public URL, e.g. `https://aragandu.up.railway.app`
3. Generate a public domain for the service (Settings → Networking), then deploy.
4. Create the first staff login from inside the service, where the private
   database host resolves: `railway ssh`, then
   `npm run user:create -- --email you@argandu.farm --name "Your Name"`.

`db:seed` refuses to run when `NODE_ENV=production` — it's demo data with published
passwords.

**Custom domains:** one app can serve two addresses — staff and buyers.

1. Railway → the app service → Settings → Networking → **Custom Domain**: add
   `erp.argandufarms.com.ng` and `customer.argandufarms.com.ng`, and create the
   CNAME records Railway shows at your DNS provider (Railway issues the certificates).
2. Set `BETTER_AUTH_URL` = `https://erp.argandufarms.com.ng` (the staff address) and
   `PORTAL_URL` = `https://customer.argandufarms.com.ng`, then redeploy.

With `PORTAL_URL` set, the customer address *is* the buyer portal — `/` is its home,
`/orders`, `/payments` — and staff pages don't exist there; `/portal/…` links on the
staff address move to it. Buyer emails (invites, receipts, resets) and Paystack's
return use it too. Each address keeps its own sign-in. Point the Paystack webhook at
either address's `/api/paystack/webhook`. Without `PORTAL_URL`, the portal stays at
`/portal` on the one address.
# aragandu
