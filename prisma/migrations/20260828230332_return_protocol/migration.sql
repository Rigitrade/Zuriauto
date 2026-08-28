-- CreateEnum
CREATE TYPE "Cleanliness" AS ENUM ('clean', 'needsWash');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "cleanliness" "Cleanliness",
ADD COLUMN     "depositBack" BOOLEAN,
ADD COLUMN     "dueAmountCents" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "dueMethod" TEXT,
ADD COLUMN     "fullyPaid" BOOLEAN,
ADD COLUMN     "hasDuePayment" BOOLEAN,
ADD COLUMN     "keyReturned" BOOLEAN,
ADD COLUMN     "paidAmountCents" INTEGER,
ADD COLUMN     "paidOn" TIMESTAMP(3),
ADD COLUMN     "papersInside" BOOLEAN,
ADD COLUMN     "paymentMethods" TEXT[],
ADD COLUMN     "tickets" BOOLEAN,
ADD COLUMN     "ticketsNote" TEXT NOT NULL DEFAULT '';
