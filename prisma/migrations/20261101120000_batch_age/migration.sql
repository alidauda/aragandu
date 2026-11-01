-- A flock's age counts from what it was when it arrived.
ALTER TABLE "batches" ADD COLUMN "ageOnArrival" INTEGER NOT NULL DEFAULT 0;
