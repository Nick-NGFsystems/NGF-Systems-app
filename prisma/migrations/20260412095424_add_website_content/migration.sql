-- CreateTable
CREATE TABLE "website_content" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_content_client_id_key" ON "website_content"("client_id");
