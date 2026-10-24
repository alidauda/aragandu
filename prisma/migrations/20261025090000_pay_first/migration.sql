-- AlterTable
ALTER TABLE "egg_orders" ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payBy" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "paystack_charges" ADD COLUMN     "orderId" INTEGER;

-- AddForeignKey
ALTER TABLE "paystack_charges" ADD CONSTRAINT "paystack_charges_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "egg_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Orders are now paid up front. Open orders from earlier weeks had already
-- expired; this week's open orders get 24 hours to be paid for.
UPDATE "egg_orders" SET "status" = 'declined', "declineReason" = 'Expired'
WHERE "status" = 'pending'
  AND "date" < date_trunc('week', now() AT TIME ZONE 'Africa/Lagos')::date;

UPDATE "egg_orders" SET "payBy" = now() + interval '24 hours'
WHERE "status" = 'pending' AND "paidAt" IS NULL;
