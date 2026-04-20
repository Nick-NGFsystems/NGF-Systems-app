-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "contact_names" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;
