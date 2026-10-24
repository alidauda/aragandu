-- AlterTable
ALTER TABLE "customer_credits" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'advance',
ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "orderId" INTEGER;


-- Classify what's already there, from the notes the app wrote.
UPDATE "customer_credits" SET "kind" = 'draw' WHERE "paymentId" IS NOT NULL;
UPDATE "customer_credits" SET "kind" = 'refund' WHERE "note" LIKE 'Refunded%';
UPDATE "customer_credits" SET "kind" = 'overpayment' WHERE "note" LIKE 'Overpaid%';
UPDATE "customer_credits" SET "kind" = 'order',
  "orderId" = NULLIF(substring("note" from 'order #([0-9]+)'), '')::int
  WHERE "note" LIKE 'Paid online for order%' OR "note" LIKE 'Paid for order%';
UPDATE "customer_credits" SET "method" = 'paystack' WHERE "kind" <> 'draw' AND "note" LIKE '%Paystack%';
UPDATE "customer_credits" SET "method" = 'transfer' WHERE "kind" <> 'draw' AND "method" IS NULL AND "note" ~ 'by transfer';
UPDATE "customer_credits" SET "method" = 'cash' WHERE "kind" <> 'draw' AND "method" IS NULL AND "note" ~ 'by cash';
UPDATE "customer_credits" SET "method" = 'pos' WHERE "kind" <> 'draw' AND "method" IS NULL AND "note" ~ 'by pos';
