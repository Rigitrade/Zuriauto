-- Payment emails, made safe after 05.11.2026 (lib/rental/paymentMailGuard.ts,
-- lib/payments/mails.ts): the office can answer a payment email from the
-- payments page, send a please-ignore correction, and is told once a day when
-- the safety stop holds the renters' payment emails back.

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'CHARGE_CORRECTION';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "reviewOutcome" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewedByName" TEXT;

-- CreateTable
CREATE TABLE "OfficeNotice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficeNotice_organisationId_kind_dedupeKey_key" ON "OfficeNotice"("organisationId", "kind", "dedupeKey");
