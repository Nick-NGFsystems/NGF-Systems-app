-- AlterTable: add draft_content column (nullable JSON) to website_content
ALTER TABLE "website_content" ADD COLUMN IF NOT EXISTS "draft_content" JSONB;
