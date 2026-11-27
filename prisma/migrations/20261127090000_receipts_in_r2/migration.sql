
-- AlterTable
ALTER TABLE "payment_proofs" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

