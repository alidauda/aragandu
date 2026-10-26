-- Manual payments: the bank account buyers pay into. The free-text note
-- stays for anything else they should know.
ALTER TABLE "settings" ADD COLUMN "bankName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "accountName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "accountNumber" TEXT NOT NULL DEFAULT '';
