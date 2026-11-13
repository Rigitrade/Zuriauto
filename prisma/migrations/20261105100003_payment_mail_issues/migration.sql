-- CreateEnum
CREATE TYPE "PaymentMailIssueReason" AS ENUM ('UNSIGNED', 'UNREADABLE', 'OTHER_STORE');

-- CreateTable
CREATE TABLE "PaymentMailIssue" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "reason" "PaymentMailIssueReason" NOT NULL,
    "detail" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMailIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMailIssue_organisationId_resolvedAt_idx" ON "PaymentMailIssue"("organisationId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMailIssue_organisationId_messageKey_key" ON "PaymentMailIssue"("organisationId", "messageKey");
