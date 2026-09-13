-- CreateEnum
CREATE TYPE "CarNotificationKind" AS ENUM ('MFK_DUE');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "mfkDate" DATE;

-- CreateTable
CREATE TABLE "CarNotification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "kind" "CarNotificationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarNotification_sentAt_attempts_idx" ON "CarNotification"("sentAt", "attempts");

-- CreateIndex
CREATE UNIQUE INDEX "CarNotification_carId_kind_dedupeKey_key" ON "CarNotification"("carId", "kind", "dedupeKey");

-- CreateIndex
CREATE INDEX "Car_organisationId_mfkDate_idx" ON "Car"("organisationId", "mfkDate");

-- AddForeignKey
ALTER TABLE "CarNotification" ADD CONSTRAINT "CarNotification_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
