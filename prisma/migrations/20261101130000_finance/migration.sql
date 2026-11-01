
-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "birdPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseCost" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "manure_entries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "batchCode" TEXT,
    "bags" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "buyer" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manure_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "batchCode" TEXT,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_months" (
    "month" TEXT NOT NULL,
    "layerBag" INTEGER NOT NULL,
    "growerBag" INTEGER NOT NULL,

    CONSTRAINT "finance_months_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "manure_entries_date_idx" ON "manure_entries"("date");

-- CreateIndex
CREATE INDEX "manure_entries_batchCode_idx" ON "manure_entries"("batchCode");

-- CreateIndex
CREATE INDEX "finance_entries_date_idx" ON "finance_entries"("date");

-- AddForeignKey
ALTER TABLE "manure_entries" ADD CONSTRAINT "manure_entries_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

