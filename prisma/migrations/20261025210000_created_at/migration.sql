-- When each catalogue row was added. Existing rows take the time from the
-- audit log where it recorded their creation; the rest stay null.
ALTER TABLE "ingredients" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "feed_products" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "houses" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "batches" ADD COLUMN "createdAt" TIMESTAMP(3);
ALTER TABLE "inv_items" ADD COLUMN "createdAt" TIMESTAMP(3);

UPDATE "ingredients" t SET "createdAt" = a.at
  FROM (SELECT details->>'code' AS k, min(at) AS at FROM "audit_log" WHERE action = 'addIngredient' GROUP BY 1) a
  WHERE a.k = t.code;
UPDATE "feed_products" t SET "createdAt" = a.at
  FROM (SELECT details->>'sku' AS k, min(at) AS at FROM "audit_log" WHERE action = 'addProduct' GROUP BY 1) a
  WHERE a.k = t.sku;
UPDATE "houses" t SET "createdAt" = a.at
  FROM (SELECT details->>'code' AS k, min(at) AS at FROM "audit_log" WHERE action = 'addHouse' GROUP BY 1) a
  WHERE a.k = t.code;
UPDATE "batches" t SET "createdAt" = a.at
  FROM (SELECT details->>'batch' AS k, min(at) AS at FROM "audit_log" WHERE action = 'addBatch' GROUP BY 1) a
  WHERE a.k = t.code;
UPDATE "inv_items" t SET "createdAt" = a.at
  FROM (SELECT details->>'sku' AS k, min(at) AS at FROM "audit_log" WHERE action = 'addInvItem' GROUP BY 1) a
  WHERE a.k = t.sku;

ALTER TABLE "ingredients" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "feed_products" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "houses" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "batches" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "inv_items" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
