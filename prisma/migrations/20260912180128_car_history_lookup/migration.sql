-- CreateTable
CREATE TABLE "CarHistoryLookup" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "windowFrom" TIMESTAMP(3),
    "windowTo" TIMESTAMP(3),
    "matches" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarHistoryLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarHistoryLookup_carId_createdAt_idx" ON "CarHistoryLookup"("carId", "createdAt");

-- CreateIndex
CREATE INDEX "CarHistoryLookup_createdAt_idx" ON "CarHistoryLookup"("createdAt");
