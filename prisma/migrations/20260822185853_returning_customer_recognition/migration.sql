-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "documentsReusedFromId" TEXT,
ADD COLUMN     "identityCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "phoneKey" TEXT;

-- CreateTable
CREATE TABLE "CustomerLookup" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "matches" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLookup_createdAt_idx" ON "CustomerLookup"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_organisationId_phoneKey_idx" ON "Customer"("organisationId", "phoneKey");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_documentsReusedFromId_fkey" FOREIGN KEY ("documentsReusedFromId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
