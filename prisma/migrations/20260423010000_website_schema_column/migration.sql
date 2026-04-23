-- Per-client schema override for the website editor.
-- When NULL the editor uses DEFAULT_SCHEMA from lib/website-schema.ts.
ALTER TABLE "website_content" ADD COLUMN IF NOT EXISTS "schema_json" JSONB;
