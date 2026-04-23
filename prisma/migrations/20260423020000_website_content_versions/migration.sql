-- CreateTable
CREATE TABLE "website_content_versions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "website_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_content_versions_client_id_published_at_idx"
    ON "website_content_versions"("client_id", "published_at" DESC);

-- AddForeignKey (referencing website_content.client_id which is unique)
ALTER TABLE "website_content_versions"
    ADD CONSTRAINT "website_content_versions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "website_content"("client_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
