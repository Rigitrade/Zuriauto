-- The car's colour, the inspection that already happened, and the
-- registration document.
--
-- Every column nullable and nothing backfilled: these are facts the office
-- types in over the following weeks, and a default would be an invention.
-- A car with no colour recorded shows no swatch, and a car with no previous
-- MFK shows a gap — both of which are the truth.
ALTER TABLE "Car" ADD COLUMN     "colour" TEXT,
ADD COLUMN     "licenceContentType" TEXT,
ADD COLUMN     "licenceKey" TEXT,
ADD COLUMN     "licenceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "mfkLastDate" DATE;
