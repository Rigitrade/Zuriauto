-- The pickup form of 16.10.2026. A weekly rental runs until the car comes
-- back, so its end is unknown while it runs; a fixed-term rental is priced per
-- day; and the office records how the renter pays. All three nullable: rentals
-- recorded before never had them, and nothing here rewrites an existing row.

-- Guarded: the payments ledger (branch feat/twint-payments, migration
-- 20261015201919_payments_ledger) creates the same type with the same four
-- values, and whichever of the two reaches a database second must not fail.
DO $$
BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('TWINT', 'CASH', 'CARD', 'BANK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Rental" ADD COLUMN     "dailyAmountCents" INTEGER,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ALTER COLUMN "endAt" DROP NOT NULL;
