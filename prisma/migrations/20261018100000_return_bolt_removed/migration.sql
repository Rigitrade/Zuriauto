-- The return form asks whether the car was taken off the renter's Bolt account.
-- Nullable: returns recorded before 18.10.2026 were never asked.
ALTER TABLE "Contract" ADD COLUMN "boltRemoved" BOOLEAN;
