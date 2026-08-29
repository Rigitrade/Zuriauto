-- AlterTable
ALTER TABLE "AssetAccess" ADD COLUMN     "contractId" TEXT,
ALTER COLUMN "assetId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AssetAccess_contractId_idx" ON "AssetAccess"("contractId");
