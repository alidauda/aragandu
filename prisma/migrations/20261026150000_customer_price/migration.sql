-- A buyer can have their own crate price (null = the farm's).
ALTER TABLE "customers" ADD COLUMN "cratePrice" INTEGER;
