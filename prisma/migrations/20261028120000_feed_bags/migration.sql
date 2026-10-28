-- Layers count feed in bags: the kg in one bag.
ALTER TABLE "settings" ADD COLUMN "feedBagKg" INTEGER NOT NULL DEFAULT 25;
