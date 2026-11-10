-- Whoever sells can upload a receipt for any buyer now, so the per-buyer switch goes.
ALTER TABLE "customers" DROP COLUMN "staffReceipts";
