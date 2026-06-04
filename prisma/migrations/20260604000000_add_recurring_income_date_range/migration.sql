-- AlterTable
-- Additive only: both columns are nullable, no backfill. Existing recurring
-- income rows keep NULL start/end, which the app treats as "always active"
-- (unchanged behavior) until an effective range is set in the editor.
ALTER TABLE "recurring_income"
ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "end_date" TIMESTAMP(3);
