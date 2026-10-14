-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('BOOKED', 'NEEDS_REVIEW', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentReviewReason" AS ENUM ('NO_PLATE', 'PLATE_NOT_IN_FLEET', 'PLATE_AMBIGUOUS', 'PLATE_DOUBTFUL', 'NO_RENTAL_AT_TIME', 'HANDOVER_BOUNDARY', 'OVERLAPPING_RENTALS', 'PAYER_MISMATCH', 'AMOUNT_MISMATCH', 'CHARGE_ALREADY_PAID');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "storeName" TEXT,
    "payerName" TEXT,
    "payerEmail" TEXT,
    "payerPhone" TEXT,
    "message" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "reviewReason" "PaymentReviewReason",
    "matchedBy" TEXT,
    "candidates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rentalId" TEXT,
    "chargeId" TEXT,
    "mailUid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_organisationId_status_idx" ON "Payment"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Payment_chargeId_idx" ON "Payment"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organisationId_externalId_key" ON "Payment"("organisationId", "externalId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
