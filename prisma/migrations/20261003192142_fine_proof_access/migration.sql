-- AlterTable
ALTER TABLE "AssetAccess" ADD COLUMN     "finePaymentProofId" TEXT;

-- CreateIndex
CREATE INDEX "AssetAccess_finePaymentProofId_idx" ON "AssetAccess"("finePaymentProofId");
