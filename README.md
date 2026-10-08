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

### Real accounts

There is no public sign-up. Accounts come from **invite links**: staff create one,
copy it, and send it however they like (WhatsApp, SMS, email). The person opens
it, chooses their own password and is signed in. Links work once and expire after
7 days; only a hash of each link is stored.

- **Staff:** ERP → **Team → Invite staff**.
- **Buyers:** ERP → **Customers → Invite** on the buyer's row.
- **The very first staff account** (before anyone can sign in):
  `npm run user:create -- --email ada@argandu.farm --name "Ada Okafor"`
  (prompts for the password, or reads `PASSWORD`).

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

Don't run `db:seed` against production — it's demo data.
# aragandu
