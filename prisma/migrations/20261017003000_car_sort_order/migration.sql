-- The office's order of the fleet (owner, 16.10.2026). Additive: null until the
-- office first orders the cars, and nothing existing is rewritten.
ALTER TABLE "Car" ADD COLUMN "sortOrder" INTEGER;
