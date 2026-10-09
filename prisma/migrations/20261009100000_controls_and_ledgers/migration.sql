-- CreateEnum
CREATE TYPE "BirdOutReason" AS ENUM ('died', 'culled', 'sold');

-- CreateEnum
CREATE TYPE "EggMoveStatus" AS ENUM ('approved', 'pending', 'rejected');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'credit';

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "inLay" DATE;

-- AlterTable
ALTER TABLE "egg_moves" ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requestedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "EggMoveStatus" NOT NULL DEFAULT 'approved';

-- AlterTable
ALTER TABLE "egg_orders" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "egg_production" ADD COLUMN     "withheld" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "inv_items" ADD COLUMN     "expiresOn" DATE,
ADD COLUMN     "withdrawalDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "layers_feed_deliveries" ADD COLUMN     "pricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "houseCode" TEXT,
ADD COLUMN     "withdrawalUntil" DATE;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "eggsPerCrate" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "vaccinations" ADD COLUMN     "withdrawalUntil" DATE;

-- CreateTable
CREATE TABLE "customer_credits" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL,
    "paymentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birds_out" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "reason" "BirdOutReason" NOT NULL,
    "birds" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birds_out_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_credits_paymentId_key" ON "customer_credits"("paymentId");

-- CreateIndex
CREATE INDEX "customer_credits_customerId_idx" ON "customer_credits"("customerId");

-- CreateIndex
CREATE INDEX "birds_out_batchCode_idx" ON "birds_out"("batchCode");

-- AddForeignKey
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birds_out" ADD CONSTRAINT "birds_out_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birds_out" ADD CONSTRAINT "birds_out_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing orders keep the price they were invoiced at; open ones take today's.
UPDATE "egg_orders" o SET "price" = i."price" FROM "invoices" i WHERE i."orderId" = o."id";
UPDATE "egg_orders" SET "price" = (SELECT "cratePrice" FROM "settings" WHERE "id" = 1) WHERE "price" IS NULL;
-- Existing flocks are taken to be in lay from when they arrived.
UPDATE "batches" SET "inLay" = "received" WHERE "inLay" IS NULL;
