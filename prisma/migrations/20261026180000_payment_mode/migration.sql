-- How buyers pay: online (Paystack) or manual (outside the app), and the
-- payment instructions buyers see.
ALTER TABLE "settings" ADD COLUMN "paymentMode" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "settings" ADD COLUMN "paymentNote" TEXT NOT NULL DEFAULT '';
