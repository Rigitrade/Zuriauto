-- CreateEnum
CREATE TYPE "CarStatus" AS ENUM ('available', 'rented', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "RentalType" AS ENUM ('WEEKLY', 'FIXED_TERM');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('ACTIVE', 'EXTENSION_REQUESTED', 'RETURN_SUBMITTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('PICKUP', 'RETURN_ADDENDUM');

-- CreateEnum
CREATE TYPE "FuelLevel" AS ENUM ('empty', 'quarter', 'half', 'three_quarter', 'full');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('PORTRAIT', 'ID_FRONT', 'ID_BACK', 'LICENCE_FRONT', 'LICENCE_BACK', 'CONDITION_PHOTO', 'SIGNATURE', 'DAMAGE_PHOTO');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "status" "CarStatus" NOT NULL DEFAULT 'available',
    "telematicsDeviceId" TEXT,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "type" "RentalType" NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'chf',
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "weeklyAmountCents" INTEGER,
    "totalWeeks" INTEGER,
    "billingWeekday" INTEGER,
    "totalAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "kind" "ContractKind" NOT NULL,
    "mileageKm" INTEGER NOT NULL,
    "fuelLevel" "FuelLevel" NOT NULL,
    "damageNotes" TEXT NOT NULL DEFAULT '',
    "gtcVersion" TEXT NOT NULL,
    "gtcLanguage" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfKey" TEXT,
    "mailSentAt" TIMESTAMP(3),
    "mailError" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalEvent" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractCounter" (
    "organisationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContractCounter_pkey" PRIMARY KEY ("organisationId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Car_organisationId_plate_key" ON "Car"("organisationId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "Car_organisationId_slug_key" ON "Car"("organisationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organisationId_email_key" ON "Customer"("organisationId", "email");

-- CreateIndex
CREATE INDEX "Rental_organisationId_status_endAt_idx" ON "Rental"("organisationId", "status", "endAt");

-- CreateIndex
CREATE INDEX "Rental_carId_startAt_endAt_idx" ON "Rental"("carId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Contract_rentalId_idx" ON "Contract"("rentalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_organisationId_contractNumber_key" ON "Contract"("organisationId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_contractId_idx" ON "Asset"("contractId");

-- CreateIndex
CREATE INDEX "RentalEvent_rentalId_createdAt_idx" ON "RentalEvent"("rentalId", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_ipHash_createdAt_idx" ON "SubmissionAttempt"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalEvent" ADD CONSTRAINT "RentalEvent_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractCounter" ADD CONSTRAINT "ContractCounter_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
