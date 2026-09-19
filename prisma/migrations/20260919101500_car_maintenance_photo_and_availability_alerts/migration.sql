-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('planned', 'done');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "currentMileageKm" INTEGER,
ADD COLUMN     "mileageReadAt" TIMESTAMP(3),
ADD COLUMN     "photoContentType" TEXT,
ADD COLUMN     "photoKey" TEXT,
ADD COLUMN     "photoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "serviceDoneKm" INTEGER,
ADD COLUMN     "serviceDoneOn" DATE,
ADD COLUMN     "serviceDueKm" INTEGER;

-- CreateTable
CREATE TABLE "CarRepair" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'planned',
    "details" TEXT NOT NULL,
    "plannedFor" DATE,
    "doneOn" DATE,
    "mileageKm" INTEGER,
    "costCents" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityAlert" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "unsubscribeToken" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarRepair_carId_status_createdAt_idx" ON "CarRepair"("carId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityAlert_unsubscribeToken_key" ON "AvailabilityAlert"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "AvailabilityAlert_organisationId_notifiedAt_cancelledAt_idx" ON "AvailabilityAlert"("organisationId", "notifiedAt", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityAlert_organisationId_email_key" ON "AvailabilityAlert"("organisationId", "email");

-- AddForeignKey
ALTER TABLE "CarRepair" ADD CONSTRAINT "CarRepair_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

