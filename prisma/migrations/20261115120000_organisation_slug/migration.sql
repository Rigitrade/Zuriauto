-- Multi-company phase A (15.11.2026): a short name per company for its public
-- links (zuriauto.ch/<slug>/pickup). ZURIAUTO, the oldest and today the only
-- company, becomes `zuriauto`. On an empty database the UPDATE touches nothing.

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- Data
UPDATE "Organisation" SET "slug" = 'zuriauto'
WHERE "id" = (SELECT "id" FROM "Organisation" ORDER BY "createdAt" ASC LIMIT 1);
