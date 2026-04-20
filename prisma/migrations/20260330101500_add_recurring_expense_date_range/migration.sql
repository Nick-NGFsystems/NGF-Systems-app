-- AlterTable
ALTER TABLE "recurring_expenses"
ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "end_date" TIMESTAMP(3);

-- Backfill existing rows to keep historical behavior anchored to creation time
UPDATE "recurring_expenses"
SET "start_date" = "created"
WHERE "start_date" IS NULL;

-- Enforce required start date after backfill
ALTER TABLE "recurring_expenses"
ALTER COLUMN "start_date" SET NOT NULL,
ALTER COLUMN "start_date" SET DEFAULT CURRENT_TIMESTAMP;
