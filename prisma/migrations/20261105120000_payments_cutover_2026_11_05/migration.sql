-- The payments cut-over, run once on deploy (lib/payments/cutover.ts does the
-- same from scripts/payments-cutover.ts; this is that run, as data).
--
-- Every week (not week 0, the balance declared at a return) still open and
-- due before Thursday 05.11.2026 00:00 Zurich (= 04.11.2026 23:00 UTC) is
-- counted as settled before the system started. That includes the weeks the
-- first daily run requested by mistake on 05.11.2026. Paid and void weeks
-- are not touched. The office reopens any week it knows is still unpaid
-- ("Wieder öffnen" in the rental account), and the daily job then handles it.
--
-- Only for an organisation whose cut-over has not run; a second deploy, or a
-- database that already ran the script, changes nothing.

WITH org AS (
  SELECT "id" FROM "Organisation" WHERE "paymentsCutoverAt" IS NULL
),
open AS (
  SELECT c."id", c."rentalId", c."weekNumber", c."status"::text AS "previous"
  FROM "Charge" c
  JOIN org o ON o."id" = c."organisationId"
  WHERE c."weekNumber" > 0
    AND c."status" IN ('SCHEDULED', 'REQUESTED', 'REMINDED', 'OVERDUE')
    AND c."dueDate" < TIMESTAMP '2026-11-04 23:00:00'
),
moved AS (
  UPDATE "Charge" c SET "status" = 'SETTLED'
  FROM open
  WHERE c."id" = open."id"
  RETURNING open."id", open."rentalId", open."weekNumber", open."previous"
),
logged AS (
  INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload", "createdAt")
  SELECT
    gen_random_uuid()::text,
    m."rentalId",
    'charges.settled.cutover',
    jsonb_build_object(
      'before', '2026-11-04T23:00:00.000Z',
      'charges', jsonb_agg(
        jsonb_build_object('id', m."id", 'weekNumber', m."weekNumber", 'previous', m."previous")
        ORDER BY m."weekNumber"
      )
    ),
    CURRENT_TIMESTAMP
  FROM moved m
  GROUP BY m."rentalId"
  RETURNING 1
)
UPDATE "Organisation"
SET "paymentsCutoverAt" = TIMESTAMP '2026-11-04 23:00:00'
WHERE "id" IN (SELECT "id" FROM org)
  AND (SELECT count(*) FROM logged) >= 0;
