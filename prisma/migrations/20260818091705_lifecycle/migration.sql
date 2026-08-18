-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('SCHEDULED', 'REQUESTED', 'REMINDED', 'OVERDUE', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('RENTAL_ENDING', 'RENTAL_OVERDUE', 'CHARGE_REQUESTED', 'CHARGE_REMINDER', 'CHARGE_OVERDUE', 'EXTENSION_CONFIRMED', 'RETURN_INTENT');

-- CreateEnum
CREATE TYPE "ActionTokenPurpose" AS ENUM ('MANAGE_RENTAL');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'chf',
    "status" "ChargeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paymentUrl" TEXT,
    "providerRef" TEXT,
    "requestedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "officeAlertedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "purpose" "ActionTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_status_dueDate_idx" ON "Charge"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_rentalId_weekNumber_key" ON "Charge"("rentalId", "weekNumber");

-- CreateIndex
CREATE INDEX "Notification_sentAt_attempts_idx" ON "Notification"("sentAt", "attempts");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_rentalId_kind_dedupeKey_key" ON "Notification"("rentalId", "kind", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActionToken_rentalId_purpose_idx" ON "ActionToken"("rentalId", "purpose");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
