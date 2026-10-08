-- AlterTable
ALTER TABLE "inv_moves" ADD COLUMN     "medicationId" INTEGER,
ADD COLUMN     "vaccinationId" INTEGER;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "inv_moves_vaccinationId_key" ON "inv_moves"("vaccinationId");

-- CreateIndex
CREATE UNIQUE INDEX "inv_moves_medicationId_key" ON "inv_moves"("medicationId");

-- AddForeignKey
ALTER TABLE "inv_moves" ADD CONSTRAINT "inv_moves_vaccinationId_fkey" FOREIGN KEY ("vaccinationId") REFERENCES "vaccinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_moves" ADD CONSTRAINT "inv_moves_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The earliest staff account becomes the first admin.
UPDATE "user" SET "role" = 'admin'
WHERE "id" = (SELECT "id" FROM "user" WHERE "role" = 'staff' ORDER BY "createdAt" ASC LIMIT 1);
