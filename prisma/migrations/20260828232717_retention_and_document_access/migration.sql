-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AssetAccess" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAccess_assetId_idx" ON "AssetAccess"("assetId");

-- CreateIndex
CREATE INDEX "AssetAccess_createdAt_idx" ON "AssetAccess"("createdAt");

-- CreateIndex
CREATE INDEX "Asset_deletedAt_createdAt_idx" ON "Asset"("deletedAt", "createdAt");
