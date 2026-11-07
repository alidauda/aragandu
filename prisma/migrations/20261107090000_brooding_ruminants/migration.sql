
-- AlterTable
ALTER TABLE "broiler_batches" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'broilers';

-- AlterTable
ALTER TABLE "broiler_expenses" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'broilers';

-- AlterTable
ALTER TABLE "broiler_feed_deliveries" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'broilers';

-- AlterTable
ALTER TABLE "broiler_houses" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'broilers';

-- CreateTable
CREATE TABLE "brooding_dispatches" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "batchCode" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "layersBatch" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brooding_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" SERIAL NOT NULL,
    "tag" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT NOT NULL DEFAULT '',
    "sex" TEXT NOT NULL,
    "born" DATE,
    "joined" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "dam" TEXT NOT NULL DEFAULT '',
    "pen" TEXT NOT NULL DEFAULT '',
    "purchaseCost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leftOn" DATE,
    "leftNote" TEXT NOT NULL DEFAULT '',
    "invoiceId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_weights" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "animalId" INTEGER NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_health" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "animalId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "dosage" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruminant_feed" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "species" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "productId" INTEGER,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruminant_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brooding_dispatches_layersBatch_key" ON "brooding_dispatches"("layersBatch");

-- CreateIndex
CREATE UNIQUE INDEX "animals_tag_key" ON "animals"("tag");

-- CreateIndex
CREATE INDEX "animals_species_status_idx" ON "animals"("species", "status");

-- CreateIndex
CREATE INDEX "animal_weights_animalId_idx" ON "animal_weights"("animalId");

-- CreateIndex
CREATE INDEX "animal_health_animalId_idx" ON "animal_health"("animalId");

-- AddForeignKey
ALTER TABLE "brooding_dispatches" ADD CONSTRAINT "brooding_dispatches_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "broiler_batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brooding_dispatches" ADD CONSTRAINT "brooding_dispatches_layersBatch_fkey" FOREIGN KEY ("layersBatch") REFERENCES "batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_weights" ADD CONSTRAINT "animal_weights_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_health" ADD CONSTRAINT "animal_health_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruminant_feed" ADD CONSTRAINT "ruminant_feed_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

