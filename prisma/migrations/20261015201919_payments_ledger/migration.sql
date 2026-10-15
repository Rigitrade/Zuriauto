-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TWINT', 'CASH', 'CARD', 'BANK');

-- AlterEnum
ALTER TYPE "ChargeStatus" ADD VALUE 'SETTLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentReviewReason" ADD VALUE 'PICKUP_PAYMENT';
ALTER TYPE "PaymentReviewReason" ADD VALUE 'PAID_AFTER_RETURN';

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN     "keptAfterReturn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "paymentsCutoverAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "depositCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'TWINT',
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "PayerAlias" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourcePaymentId" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayerAlias_organisationId_kind_value_idx" ON "PayerAlias"("organisationId", "kind", "value");

-- CreateIndex
CREATE INDEX "PayerAlias_sourcePaymentId_idx" ON "PayerAlias"("sourcePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayerAlias_organisationId_kind_value_customerId_key" ON "PayerAlias"("organisationId", "kind", "value", "customerId");

-- AddForeignKey
ALTER TABLE "PayerAlias" ADD CONSTRAINT "PayerAlias_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerAlias" ADD CONSTRAINT "PayerAlias_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
