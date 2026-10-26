-- Store items: tools and general farm items.
ALTER TYPE "InvCategory" ADD VALUE 'tools';
ALTER TYPE "InvCategory" ADD VALUE 'farm';

-- A batch can be spread over several houses: one row per house with the
-- birds there now.
CREATE TABLE "batch_placements" (
    "batchCode" TEXT NOT NULL,
    "houseCode" TEXT NOT NULL,
    "birds" INTEGER NOT NULL,

    CONSTRAINT "batch_placements_pkey" PRIMARY KEY ("batchCode","houseCode")
);
CREATE INDEX "batch_placements_houseCode_idx" ON "batch_placements"("houseCode");
ALTER TABLE "batch_placements" ADD CONSTRAINT "batch_placements_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_placements" ADD CONSTRAINT "batch_placements_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every active batch's live birds go to the house it was in.
INSERT INTO "batch_placements" ("batchCode", "houseCode", "birds")
SELECT "code", "houseCode", "birds" - "mortality"
FROM "batches"
WHERE "houseCode" IS NOT NULL AND "status" = 'active' AND "birds" - "mortality" > 0;

-- Birds out remember the house they left; past ones take the batch's house.
ALTER TABLE "birds_out" ADD COLUMN "houseCode" TEXT;
UPDATE "birds_out" o SET "houseCode" = b."houseCode"
FROM "batches" b
WHERE b."code" = o."batchCode" AND b."houseCode" IS NOT NULL;
ALTER TABLE "birds_out" ADD CONSTRAINT "birds_out_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "batches" DROP CONSTRAINT "batches_houseCode_fkey";
ALTER TABLE "batches" DROP COLUMN "houseCode";
