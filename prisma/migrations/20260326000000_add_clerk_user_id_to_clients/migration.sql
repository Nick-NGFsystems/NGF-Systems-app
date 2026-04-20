-- AlterTable
ALTER TABLE "clients" ADD COLUMN "clerk_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_clerk_user_id_key" ON "clients"("clerk_user_id");
