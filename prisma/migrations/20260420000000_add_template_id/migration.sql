-- AlterTable: add template_id column to client_configs with default 'generic'
ALTER TABLE "client_configs" ADD COLUMN IF NOT EXISTS "template_id" TEXT DEFAULT 'generic';
