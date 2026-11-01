-- Eggs, feed and water can belong to a flock, so flocks can be compared,
-- not just houses.

-- AlterTable
ALTER TABLE "egg_production" ADD COLUMN     "batchCode" TEXT;

-- AlterTable
ALTER TABLE "feed_use" ADD COLUMN     "batchCode" TEXT;

-- AlterTable
ALTER TABLE "water_logs" ADD COLUMN     "batchCode" TEXT;

-- CreateIndex
CREATE INDEX "egg_production_batchCode_idx" ON "egg_production"("batchCode");

-- CreateIndex
CREATE INDEX "feed_use_batchCode_idx" ON "feed_use"("batchCode");

-- CreateIndex
CREATE INDEX "water_logs_batchCode_idx" ON "water_logs"("batchCode");

-- AddForeignKey
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_use" ADD CONSTRAINT "feed_use_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE SET NULL ON UPDATE CASCADE;


-- Past records: only where it's certain — the house holds exactly one flock,
-- and the record isn't from before that flock arrived. The rest stay unlinked.
CREATE TEMP TABLE only_flock AS
  SELECT p."houseCode", min(p."batchCode") AS "batchCode", min(b."received") AS received
  FROM "batch_placements" p JOIN "batches" b ON b."code" = p."batchCode"
  WHERE b."status" = 'active'
  GROUP BY p."houseCode"
  HAVING count(*) = 1;

UPDATE "egg_production" t SET "batchCode" = o."batchCode"
  FROM only_flock o WHERE o."houseCode" = t."houseCode" AND t."date" >= o.received;
UPDATE "feed_use" t SET "batchCode" = o."batchCode"
  FROM only_flock o WHERE o."houseCode" = t."houseCode" AND t."date" >= o.received;
UPDATE "water_logs" t SET "batchCode" = o."batchCode"
  FROM only_flock o WHERE o."houseCode" = t."houseCode" AND t."date" >= o.received;

DROP TABLE only_flock;
