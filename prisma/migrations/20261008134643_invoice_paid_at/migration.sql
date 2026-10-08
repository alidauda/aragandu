-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paidAt" DATE;

-- Backfill: existing paid invoices are taken as paid on their invoice date.
UPDATE "invoices" SET "paidAt" = "date" WHERE "status" = 'paid';
