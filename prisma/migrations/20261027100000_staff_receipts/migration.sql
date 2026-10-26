-- Sales staff may upload payment receipts for this buyer (admins always can).
ALTER TABLE "customers" ADD COLUMN "staffReceipts" BOOLEAN NOT NULL DEFAULT false;
