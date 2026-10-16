-- Naming the driver to the issuing authority (owner's decision of 16.10.2026,
-- lib/fines/nominate.ts). Additive only: a status, the reasons a nomination
-- waits for the office, two mail kinds, the authorities' confirmed addresses,
-- and where each fine stands with them.
ALTER TYPE "FineNotificationKind" ADD VALUE 'DRIVER_NOMINATION';
ALTER TYPE "FineNotificationKind" ADD VALUE 'RENTER_NAMED';

ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_NO_EMAIL';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_SEVERAL_EMAILS';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_NEW_ADDRESS';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_ADDRESS_CHANGED';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_NO_AUTHORITY';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_NO_NUMBER';
ALTER TYPE "FineReviewReason" ADD VALUE 'NOMINATION_DRIVER_INCOMPLETE';

ALTER TYPE "FineStatus" ADD VALUE 'DRIVER_NAMED';

ALTER TABLE "Fine" ADD COLUMN     "authorityEmailRead" TEXT,
ADD COLUMN     "authorityId" TEXT,
ADD COLUMN     "driverNamedAt" TIMESTAMP(3),
ADD COLUMN     "driverNamedTo" TEXT;

CREATE TABLE "FineAuthority" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineAuthority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FineAuthority_organisationId_iban_key" ON "FineAuthority"("organisationId", "iban");

ALTER TABLE "Fine" ADD CONSTRAINT "Fine_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "FineAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FineAuthority" ADD CONSTRAINT "FineAuthority_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
