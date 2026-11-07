@AGENTS.md

# Project rules

- Every page with a table must have pagination. Use `usePaged` from `src/components/erp/ui.tsx` and pass its `pager` to `Table`. Printed documents and emails show every row.
- Every new division, section or figure must show on the main dashboard (`src/app/(erp)/page.tsx`), the whole farm at a glance for the owner and farm-wide members. Anything with money must also reach Finance (`src/lib/erp/finance.ts`), and anything that uses store items must draw them from Inventory.
