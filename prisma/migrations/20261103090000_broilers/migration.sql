
-- CreateTable
CREATE TABLE "broiler_houses" (
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_houses_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "broiler_batches" (
    "code" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "received" DATE NOT NULL,
    "ageOnArrival" INTEGER NOT NULL DEFAULT 0,
    "chickWeight" INTEGER NOT NULL DEFAULT 40,
    "birds" INTEGER NOT NULL,
    "houseCode" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'active',
    "closedAt" DATE,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_batches_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "broiler_daily" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "feedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "litres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "died" INTEGER NOT NULL DEFAULT 0,
    "culled" INTEGER NOT NULL DEFAULT 0,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_weighings" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_weighings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_sales" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_feed_deliveries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "supplier" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_feed_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broiler_health" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "dosage" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broiler_health_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broiler_daily_batchCode_idx" ON "broiler_daily"("batchCode");

-- CreateIndex
CREATE INDEX "broiler_weighings_batchCode_idx" ON "broiler_weighings"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "broiler_sales_invoiceId_key" ON "broiler_sales"("invoiceId");

-- CreateIndex
CREATE INDEX "broiler_health_batchCode_idx" ON "broiler_health"("batchCode");

-- AddForeignKey
ALTER TABLE "broiler_batches" ADD CONSTRAINT "broiler_batches_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "broiler_houses"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_daily" ADD CONSTRAINT "broiler_daily_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_weighings" ADD CONSTRAINT "broiler_weighings_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_sales" ADD CONSTRAINT "broiler_sales_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_sales" ADD CONSTRAINT "broiler_sales_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_health" ADD CONSTRAINT "broiler_health_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE CASCADE ON UPDATE CASCADE;

