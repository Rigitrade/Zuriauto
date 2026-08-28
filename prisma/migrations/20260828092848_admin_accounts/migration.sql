-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'staff');

-- DropIndex
DROP INDEX "SubmissionAttempt_ipHash_createdAt_idx";

-- AlterTable
ALTER TABLE "SubmissionAttempt" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'pickup';

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'staff',
    "passwordHash" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "credentialsChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUser_organisationId_disabledAt_idx" ON "AdminUser"("organisationId", "disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_organisationId_username_key" ON "AdminUser"("organisationId", "username");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_scope_ipHash_createdAt_idx" ON "SubmissionAttempt"("scope", "ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
