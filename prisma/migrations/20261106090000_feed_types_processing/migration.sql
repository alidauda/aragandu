
-- AlterTable
ALTER TABLE "broiler_daily" ADD COLUMN     "productId" INTEGER;

-- AlterTable
ALTER TABLE "broiler_feed_deliveries" ADD COLUMN     "productId" INTEGER;

-- AlterTable
ALTER TABLE "feed_use" ADD COLUMN     "productId" INTEGER;

-- AlterTable
ALTER TABLE "layers_feed_deliveries" ADD COLUMN     "productId" INTEGER;

-- CreateTable
CREATE TABLE "broiler_processing" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "liveKg" DOUBLE PRECISION NOT NULL,
    "carcassKg" DOUBLE PRECISION NOT NULL,
    "headFeetKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gizzardKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_sales" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "part" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "invoiceId" INTEGER NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_expenses" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "batchCode" TEXT,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broiler_processing_batchCode_idx" ON "broiler_processing"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "processed_sales_invoiceId_key" ON "processed_sales"("invoiceId");

-- CreateIndex
CREATE INDEX "broiler_expenses_date_idx" ON "broiler_expenses"("date");

-- AddForeignKey
ALTER TABLE "layers_feed_deliveries" ADD CONSTRAINT "layers_feed_deliveries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_use" ADD CONSTRAINT "feed_use_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_daily" ADD CONSTRAINT "broiler_daily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_feed_deliveries" ADD CONSTRAINT "broiler_feed_deliveries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_processing" ADD CONSTRAINT "broiler_processing_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_sales" ADD CONSTRAINT "processed_sales_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_expenses" ADD CONSTRAINT "broiler_expenses_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

