-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "access" JSONB;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "access" JSONB;


-- Carry everyone's current role over: farm-wide (no division) or one division.
UPDATE "user" SET "access" = jsonb_build_object('farm', "role", 'divisions', '{}'::jsonb, 'functions', '[]'::jsonb)
WHERE "role" IN ('admin', 'staff') AND "division" IS NULL;
UPDATE "user" SET "access" = jsonb_build_object('farm', NULL, 'divisions', jsonb_build_object("division", "role"), 'functions', '[]'::jsonb)
WHERE "role" IN ('admin', 'staff') AND "division" IS NOT NULL;
UPDATE "invites" SET "access" = jsonb_build_object('farm', "role", 'divisions', '{}'::jsonb, 'functions', '[]'::jsonb)
WHERE "role" IN ('admin', 'staff') AND "division" IS NULL;
UPDATE "invites" SET "access" = jsonb_build_object('farm', NULL, 'divisions', jsonb_build_object("division", "role"), 'functions', '[]'::jsonb)
WHERE "role" IN ('admin', 'staff') AND "division" IS NOT NULL;
