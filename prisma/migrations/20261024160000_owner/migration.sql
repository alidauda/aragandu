-- AlterTable
ALTER TABLE "user" ADD COLUMN     "owner" BOOLEAN NOT NULL DEFAULT false;


-- The farm's first admin (still active) becomes the owner.
UPDATE "user" SET "owner" = true
WHERE "id" = (
  SELECT "id" FROM "user"
  WHERE "role" = 'admin' AND "disabled" = false
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
);
