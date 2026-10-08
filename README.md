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

There is no public sign-up. Accounts come from **invite links**: an admin creates one,
copies it, and sends it however they like (WhatsApp, SMS, email). The person opens it,
chooses their own password and is signed in. Links work once and expire after 7 days;
only a hash of each link is stored.

| Role  | Can do |
| ----- | ------ |
| Admin | Everything: money (mark paid/unpaid, crate price), corrections (edit catalogs, delete entries), people (invite staff, roles, remove access) |
| Staff | Day-to-day records in the ERP; invite buyers |
| Buyer | The buyer portal for their own business |

- **Team:** ERP → **Team** → Invite staff (choose Staff or Admin), change roles, remove or restore access.
- **Buyers:** ERP → **Customers** → Invite on the buyer's row, or give an email when adding them. Admins can remove a buyer's portal access there.
- **The very first admin** (before anyone can sign in):
  `npm run user:create -- --email ada@argandu.farm --name "Ada Okafor"` (prompts for the password).
- Everyone can change their own password (sidebar → Password; portal → Change password).

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
- **Reports:** monthly sales, money in, egg production, feed mill and debtors, each with a
  CSV download.
- **Activity (admins):** the audit log — every change, who made it and when; deletes keep a
  copy of what was removed.
- **Alerts:** pending orders and requests show as counts in the sidebar and tab title; the
  ERP checks every minute and can pop a browser notification for new orders.

### Email (optional)

Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified in
[Resend](https://resend.com)) to turn on: emailing invite links, emailing invoices to buyers,
and emailing admins when a buyer orders. Without them those buttons don't appear.

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

**Custom domain:** sign-in only accepts requests from `BETTER_AUTH_URL`. When you add
a domain, set `BETTER_AUTH_URL` to it (e.g. `https://erp.argandu.farm`) and redeploy.
# aragandu
