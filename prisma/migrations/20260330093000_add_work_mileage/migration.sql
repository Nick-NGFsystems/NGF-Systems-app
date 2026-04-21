-- CreateTable
CREATE TABLE "work_mileage" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL,
    "rate_per_mile" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_mileage_pkey" PRIMARY KEY ("id")
);
