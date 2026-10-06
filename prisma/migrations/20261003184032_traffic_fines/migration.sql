-- CreateEnum
CREATE TYPE "FineDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FineDocumentKind" AS ENUM ('NOTICE', 'REMINDER', 'NOT_A_FINE', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "FineIssuerKind" AS ENUM ('POLICE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('NEEDS_REVIEW', 'NOTIFIED', 'PROOF_SUBMITTED', 'PAID', 'HANDLED_OTHERWISE', 'VOID');

-- CreateEnum
CREATE TYPE "FineReviewReason" AS ENUM ('FIELDS_MISSING', 'FIELDS_DOUBTFUL', 'QR_DISAGREES', 'NOT_A_FINE', 'PLATE_NOT_IN_FLEET', 'PLATE_AMBIGUOUS', 'NO_RENTAL_AT_TIME', 'HANDOVER_BOUNDARY', 'OVERLAPPING_RENTALS', 'NO_CUSTOMER_EMAIL', 'PROBABLE_DUPLICATE', 'REMINDER_AFTER_PAID', 'MAIL_FAILED', 'PROCESSING_FAILED');

-- CreateEnum
CREATE TYPE "FineFeeStatus" AS ENUM ('NONE', 'DUE', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "FinePaidVia" AS ENUM ('PROOF_VERIFIED', 'PROOF_CHECKED_BY_OFFICE', 'OFFICE');

-- CreateEnum
CREATE TYPE "FineProofVerdict" AS ENUM ('MATCH', 'MISMATCH', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "FineNotificationKind" AS ENUM ('FINE_NOTICE', 'FINE_REMINDER', 'FINE_REOPENED', 'FINE_PAID', 'OFFICE_ALERT', 'OFFICE_DIGEST');

-- AlterEnum
ALTER TYPE "ActionTokenPurpose" ADD VALUE 'FINE_PAYMENT';

-- AlterTable
ALTER TABLE "ActionToken" ADD COLUMN     "fineId" TEXT;

-- AlterTable
ALTER TABLE "AssetAccess" ADD COLUMN     "fineDocumentId" TEXT;

-- CreateTable
CREATE TABLE "FineDocument" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "pages" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FineDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "kind" "FineDocumentKind",
    "language" TEXT,
    "reader" TEXT,
    "qrText" TEXT,
    "ocrText" TEXT,
    "extraction" JSONB,
    "fineId" TEXT,

    CONSTRAINT "FineDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fine" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "issuerKind" "FineIssuerKind",
    "issuerName" TEXT,
    "issuerIban" TEXT,
    "fineNumber" TEXT,
    "paymentReference" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "violationAt" TIMESTAMP(3),
    "violationTimeKnown" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "offenceCode" TEXT,
    "offenceTextOriginal" TEXT,
    "offenceTextDe" TEXT,
    "offenceTextEn" TEXT,
    "speedMeasuredKmh" INTEGER,
    "speedLimitKmh" INTEGER,
    "letterDate" DATE,
    "dueDate" DATE,
    "reminderLevel" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAsReminder" BOOLEAN NOT NULL DEFAULT false,
    "carId" TEXT,
    "rentalId" TEXT,
    "customerId" TEXT,
    "status" "FineStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "reviewReason" "FineReviewReason",
    "handlingFeeCents" INTEGER NOT NULL DEFAULT 0,
    "handlingFeeStatus" "FineFeeStatus" NOT NULL DEFAULT 'NONE',
    "notifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidVia" "FinePaidVia",
    "closedById" TEXT,
    "closedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinePaymentProof" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidOn" DATE,
    "ocrText" TEXT,
    "verdict" "FineProofVerdict" NOT NULL,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "accepted" BOOLEAN,

    CONSTRAINT "FinePaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineEvent" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineNotification" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "kind" "FineNotificationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FineDocument_storageKey_key" ON "FineDocument"("storageKey");

-- CreateIndex
CREATE INDEX "FineDocument_status_uploadedAt_idx" ON "FineDocument"("status", "uploadedAt");

-- CreateIndex
CREATE INDEX "FineDocument_fineId_idx" ON "FineDocument"("fineId");

-- CreateIndex
CREATE UNIQUE INDEX "FineDocument_organisationId_sha256_key" ON "FineDocument"("organisationId", "sha256");

-- CreateIndex
CREATE INDEX "Fine_organisationId_status_idx" ON "Fine"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Fine_organisationId_paymentReference_idx" ON "Fine"("organisationId", "paymentReference");

-- CreateIndex
CREATE INDEX "Fine_organisationId_issuerIban_fineNumber_idx" ON "Fine"("organisationId", "issuerIban", "fineNumber");

-- CreateIndex
CREATE INDEX "Fine_carId_violationAt_idx" ON "Fine"("carId", "violationAt");

-- CreateIndex
CREATE INDEX "Fine_status_dueDate_idx" ON "Fine"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinePaymentProof_storageKey_key" ON "FinePaymentProof"("storageKey");

-- CreateIndex
CREATE INDEX "FinePaymentProof_fineId_idx" ON "FinePaymentProof"("fineId");

-- CreateIndex
CREATE INDEX "FineEvent_fineId_createdAt_idx" ON "FineEvent"("fineId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FineNotification_fineId_kind_dedupeKey_key" ON "FineNotification"("fineId", "kind", "dedupeKey");

-- CreateIndex
CREATE INDEX "ActionToken_fineId_idx" ON "ActionToken"("fineId");

-- CreateIndex
CREATE INDEX "AssetAccess_fineDocumentId_idx" ON "AssetAccess"("fineDocumentId");

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineDocument" ADD CONSTRAINT "FineDocument_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineDocument" ADD CONSTRAINT "FineDocument_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinePaymentProof" ADD CONSTRAINT "FinePaymentProof_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineEvent" ADD CONSTRAINT "FineEvent_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineNotification" ADD CONSTRAINT "FineNotification_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "Fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One fine per issuer and number, where both are known. Partial, because a
-- letter that names neither must still be recordable — and Prisma cannot
-- express a partial index, so it lives here rather than in the schema.
CREATE UNIQUE INDEX "Fine_organisationId_issuerIban_fineNumber_key"
  ON "Fine" ("organisationId", "issuerIban", "fineNumber")
  WHERE "issuerIban" IS NOT NULL AND "fineNumber" IS NOT NULL;
