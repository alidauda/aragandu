-- A receipt can belong to a walk-in buyer's invoice, which has no buyer account.
ALTER TABLE "payment_proofs" ALTER COLUMN "customerId" DROP NOT NULL;
