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

There is no public sign-up.

- **Staff:** `npm run user:create -- --email ada@argandu.farm --name "Ada Okafor"`
  (prompts for the password, or reads `PASSWORD`).
- **Buyers:** staff issue them from **Customers → Issue login** in the ERP.

## Scripts

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run db:migrate` | Create and apply migrations (development)    |
| `npm run db:deploy`  | Apply pending migrations (production)        |
| `npm run db:seed`    | Load demo data into an empty database        |
| `npm run user:create`| Create a staff or customer login             |

The farm's calendar ("today", the Monday week start) is computed in Africa/Lagos —
see `src/lib/dates.ts`.
# aragandu
