/*
  Warnings:

  - You are about to drop the column `note` on the `expenses` table. All the data in the column will be lost.
  - Added the required column `title` to the `expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "note",
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "next_due" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paid_date" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'ONE_TIME';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paid_date" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'ONE_TIME',
ALTER COLUMN "client_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
