
-- AlterTable
ALTER TABLE "manure_entries" ADD COLUMN     "invoiceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "manure_entries_invoiceId_key" ON "manure_entries"("invoiceId");

-- AddForeignKey
ALTER TABLE "manure_entries" ADD CONSTRAINT "manure_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

