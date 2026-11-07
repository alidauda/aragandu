
-- DropForeignKey
ALTER TABLE "brooding_dispatches" DROP CONSTRAINT "brooding_dispatches_layersBatch_fkey";

-- AlterTable
ALTER TABLE "animal_health" ADD COLUMN     "itemId" INTEGER,
ADD COLUMN     "qty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "broiler_health" ADD COLUMN     "itemId" INTEGER,
ADD COLUMN     "qty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "brooding_dispatches" ADD COLUMN     "broilerBatch" TEXT,
ALTER COLUMN "layersBatch" DROP NOT NULL;

-- AlterTable
ALTER TABLE "inv_moves" ADD COLUMN     "animalHealthId" INTEGER,
ADD COLUMN     "broilerHealthId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "brooding_dispatches_broilerBatch_key" ON "brooding_dispatches"("broilerBatch");

-- CreateIndex
CREATE UNIQUE INDEX "inv_moves_broilerHealthId_key" ON "inv_moves"("broilerHealthId");

-- CreateIndex
CREATE UNIQUE INDEX "inv_moves_animalHealthId_key" ON "inv_moves"("animalHealthId");

-- AddForeignKey
ALTER TABLE "inv_moves" ADD CONSTRAINT "inv_moves_broilerHealthId_fkey" FOREIGN KEY ("broilerHealthId") REFERENCES "broiler_health"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_moves" ADD CONSTRAINT "inv_moves_animalHealthId_fkey" FOREIGN KEY ("animalHealthId") REFERENCES "animal_health"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broiler_health" ADD CONSTRAINT "broiler_health_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inv_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brooding_dispatches" ADD CONSTRAINT "brooding_dispatches_layersBatch_fkey" FOREIGN KEY ("layersBatch") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brooding_dispatches" ADD CONSTRAINT "brooding_dispatches_broilerBatch_fkey" FOREIGN KEY ("broilerBatch") REFERENCES "broiler_batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_health" ADD CONSTRAINT "animal_health_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inv_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

