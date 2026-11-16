-- Partner companies' payments are tracked from the day they were created
-- (16.11.2026). Without a start, the open-balances list (Zahlungen, the
-- overview's count) stayed empty for every partner. ZURIAUTO's own start is
-- set by the cut-over script and is never touched here.
UPDATE "Organisation"
SET "paymentsCutoverAt" = "createdAt"
WHERE "paymentsCutoverAt" IS NULL
  AND ("slug" IS NULL OR "slug" <> 'zuriauto');
