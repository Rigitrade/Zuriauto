-- The office's fines list from before the system (paper rentals), taken over
-- as history: a renter per driver, a rental per driver and car spanning the
-- first to the last fine day, and each fine closed on that rental.
-- Renters have placeholder emails and an unknown birth date, so nothing is
-- ever sent to them or reported about them; the rentals are COMPLETED with no
-- money, like the legacy PDF imports. Every insert selects from existing rows,
-- so on an empty database this writes nothing.

INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcya630c60f5b39531f421d1', o."id", 'Adem', '(Altdaten)', 'renter-legacy-lgcya630c60f5b39531f421d1@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyaadac97a0532831122d34', o."id", 'Aliyev', '(Altdaten)', 'renter-legacy-lgcyaadac97a0532831122d34@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyca3ae1ccd5a4d63790eb8', o."id", 'Antonios', '(Altdaten)', 'renter-legacy-lgcyca3ae1ccd5a4d63790eb8@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy6e1c590d4d3e7d7fec153', o."id", 'Sinisa', 'Dzonic (Altdaten)', 'renter-legacy-lgcy6e1c590d4d3e7d7fec153@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy43a570800a1900741c045', o."id", 'Hazem', '(Altdaten)', 'renter-legacy-lgcy43a570800a1900741c045@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyad00bf9fa71d445cff2b3', o."id", 'Ibo', '(Altdaten)', 'renter-legacy-lgcyad00bf9fa71d445cff2b3@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy31ab90a47033a70cf4b02', o."id", 'Ionut', '(Altdaten)', 'renter-legacy-lgcy31ab90a47033a70cf4b02@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcya832f03740cbb023e55f4', o."id", 'Jennifer', '(Altdaten)', 'renter-legacy-lgcya832f03740cbb023e55f4@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy6b9491a45d2c80be80edc', o."id", 'Kante', '(Altdaten)', 'renter-legacy-lgcy6b9491a45d2c80be80edc@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyb2662b36708c9d0de14d9', o."id", 'Krazimir', '(Altdaten)', 'renter-legacy-lgcyb2662b36708c9d0de14d9@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy48f068ad7a4e360b6b281', o."id", 'Laszlo', '(Altdaten)', 'renter-legacy-lgcy48f068ad7a4e360b6b281@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy010b1291995b95a179c27', o."id", 'Lazhar', '(Altdaten)', 'renter-legacy-lgcy010b1291995b95a179c27@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyd3c8204a436f63123290b', o."id", 'Mihai', '(Altdaten)', 'renter-legacy-lgcyd3c8204a436f63123290b@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy887481d1126c5c646acec', o."id", 'Milan', '(Altdaten)', 'renter-legacy-lgcy887481d1126c5c646acec@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcye132d6ed3b24752259919', o."id", 'Mohit', '(Altdaten)', 'renter-legacy-lgcye132d6ed3b24752259919@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcye9b66fc6b7c517c5c7c0a', o."id", 'Muddaser', '(Altdaten)', 'renter-legacy-lgcye9b66fc6b7c517c5c7c0a@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcyd38e169441861420f6c89', o."id", 'Shawky', '(Altdaten)', 'renter-legacy-lgcyd38e169441861420f6c89@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy87d5504a2fb5a8373bf70', o."id", 'Teddy', '(Altdaten)', 'renter-legacy-lgcy87d5504a2fb5a8373bf70@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;
INSERT INTO "Customer" ("id", "organisationId", "firstName", "lastName", "email", "phone", "birthDate", "street", "postalCode", "city", "country")
SELECT 'lgcy40109299d250e481f38f8', o."id", 'Valentin', '(Altdaten)', 'renter-legacy-lgcy40109299d250e481f38f8@unrecorded.invalid', '', DATE '1900-01-01', '', '', '', ''
FROM (SELECT "id" FROM "Organisation" ORDER BY "id" LIMIT 1) o;

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy708a7a7d8feda6fb82e21', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-17 22:00:00', TIMESTAMP '2026-07-18 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcye132d6ed3b24752259919' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH401859'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy81a80fb7caff7f274d9c3', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Mohit mit ZH 401 859 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy708a7a7d8feda6fb82e21';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy177bbbc8c7bc97e24f22c', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-18 19:02:00', true, 4000, 'Bergdietikon Industriestr.', '246564', '38/30 kmh', 38, 30, 'Mohit', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 056 417 92 00.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy708a7a7d8feda6fb82e21';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy9b4dbe5b5cd47c4e4058b', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy177bbbc8c7bc97e24f22c';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy3eca87b245e032c840e61', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-08-17 22:00:00', TIMESTAMP '2026-08-18 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyaadac97a0532831122d34' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH401859'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy0410a304bb73d84a938bb', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Aliyev mit ZH 401 859 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy3eca87b245e032c840e61';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcye85eec610959e2cdc486e', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-18 16:38:00', true, 7018, 'Socar Manegg', '186643', 'Tanken Nachzahlung', NULL, NULL, 'Aliyev', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 417 92 00.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy3eca87b245e032c840e61';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyb1ccafe827bdae96f1ac0', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcye85eec610959e2cdc486e';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy4d551a7450b2ee173cc2a', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-05-15 22:00:00', TIMESTAMP '2026-05-16 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy010b1291995b95a179c27' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH513925'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyf01daf48818e198b0276e', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Lazhar mit ZH 513 925 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy4d551a7450b2ee173cc2a';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy12ab667acc16da1c21e92', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-16 20:24:00', true, 10000, 'Uetlibergstr.', 'Bussen-Nr. 14592', '304.3 Fahrverbot', NULL, NULL, 'Lazhar', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 200 15 17.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy4d551a7450b2ee173cc2a';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy15b4001af6762cac523c1', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy12ab667acc16da1c21e92';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy765ca279a0a3bc1891953', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-10 22:00:00', TIMESTAMP '2026-07-11 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyd3c8204a436f63123290b' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH513925'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy153d4528d5db970481184', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Mihai mit ZH 513 925 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy765ca279a0a3bc1891953';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy4c698b1711aa6af6d50b3', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-11 09:31:00', true, 4000, 'Spreitenbach Landstr.', '245555', '55/50 kmh', 55, 50, 'Mihai', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 056 417 92 00.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy765ca279a0a3bc1891953';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyf724eacd985d29cecfe00', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy4c698b1711aa6af6d50b3';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy3112d970c42eaa94454c3', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-08-09 22:00:00', TIMESTAMP '2026-08-20 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcye9b66fc6b7c517c5c7c0a' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH513925'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy285c884f1e5eb8beee02c', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Muddaser mit ZH 513 925 (2 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy3112d970c42eaa94454c3';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy8dc6de7e458db0fe19fbd', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-10 13:46:00', true, 25000, 'Neumühlequai / Walchebrücke', '2605100070320', 'Rotlicht', NULL, NULL, 'Muddaser', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy3112d970c42eaa94454c3';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcye2c3e87dd32f7fc46dadb', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy8dc6de7e458db0fe19fbd';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyad05994cc93abed5938d9', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-19 23:43:00', true, 25000, 'Bürkliplatz / Talstrasse', '2605302070177', 'Rotlicht', NULL, NULL, 'Muddaser', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy3112d970c42eaa94454c3';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy96ed83a3e49b7fc330817', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyad05994cc93abed5938d9';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy5f15bcb7eca9a4dd1de65', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-05-09 22:00:00', TIMESTAMP '2026-05-15 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy87d5504a2fb5a8373bf70' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH589864'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyeb1e4cba223fdcdae8d45', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Teddy mit ZH 589 864 (2 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy5f15bcb7eca9a4dd1de65';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy85e6a2c9e830f1310ddda', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-10 00:06:00', true, NULL, 'Buchs ZH Zürcherstrasse', 'ST.2026.5418/DK', '55/50 kmh', 55, 50, 'Teddy', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Betrag laut Liste: 40+90. Kontakt laut Liste: 043 258 16 40.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy5f15bcb7eca9a4dd1de65';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy76ca08d9ae4aef6841572', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy85e6a2c9e830f1310ddda';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy3248873ea86f17b1d42ee', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-15 13:32:00', true, 12000, 'Breitensteinstr. 79', '2602977060077', '39/30 kmh', 39, 30, 'Teddy', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy5f15bcb7eca9a4dd1de65';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy2e0da3507cef796f2b6e3', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy3248873ea86f17b1d42ee';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy4e87d6a107433589ea0c3', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-06-18 22:00:00', TIMESTAMP '2026-06-19 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcya832f03740cbb023e55f4' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH589864'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy0bb051565e889a39b022b', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Jennifer mit ZH 589 864 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy4e87d6a107433589ea0c3';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy696790e57900173f472f7', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-19 19:23:00', true, 4000, 'Riedthofstr. Regensdorf', '129918', '36/30 kmh', 36, 30, 'Jennifer', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 842 36 00.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy4e87d6a107433589ea0c3';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy8c90df00af264df18a601', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy696790e57900173f472f7';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcye277ef211759cf3b2ea1a', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-20 22:00:00', TIMESTAMP '2026-08-08 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcya630c60f5b39531f421d1' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH589864'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy0f6de783528f6bebfbc15', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Adem mit ZH 589 864 (3 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcye277ef211759cf3b2ea1a';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyd6d80340620298c31bc03', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-21 07:55:00', true, 4000, 'Schaffhauserstr. 593', '294053210086', 'Parkscheibe unersichtlich', NULL, NULL, 'Adem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcye277ef211759cf3b2ea1a';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyf428133e0cf27a02133f5', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyd6d80340620298c31bc03';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyceeb40a1601022b634ea3', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-28 07:11:00', true, NULL, 'Zwirnereistr. 1-31 Walllisellen', '140903332', 'Wrong Parking', NULL, NULL, 'Adem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Betrag laut Liste: 70/50.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcye277ef211759cf3b2ea1a';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyb427023d909224f6bbb56', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyceeb40a1601022b634ea3';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyf67a0f9455f7e590f7f1d', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-08 01:45:00', true, 8000, 'Neufrankengasse 6 8004 ZH', 'Vorfall-Nr. 2026-08-07', 'Parking privat', NULL, NULL, 'Adem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: Eren.soyyigitoglu@gmx.ch.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcye277ef211759cf3b2ea1a';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy062ecf2a08e8b9caef0ad', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyf67a0f9455f7e590f7f1d';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy6e199c75fa921f03e1668', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-08-16 22:00:00', TIMESTAMP '2026-08-17 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy40109299d250e481f38f8' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH589864'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyc495ef64f26b973bedf29', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Valentin mit ZH 589 864 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy6e199c75fa921f03e1668';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy9fb6e06660c7d677b863f', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-17 20:49:00', true, 4000, 'Wasserwerkstr. 134', '2605286060181', '34/30 kmh', 34, 30, 'Valentin', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy6e199c75fa921f03e1668';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy42be10f2dafd0ea7f656f', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy9fb6e06660c7d677b863f';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyac167e0de479e6ff7ebe7', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-04-09 22:00:00', TIMESTAMP '2026-04-10 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy31ab90a47033a70cf4b02' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615132'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyee9b59284c9a3598e10ec', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Ionut mit ZH 615 132 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyac167e0de479e6ff7ebe7';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy13ddf17b98cd08ab36e7c', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-04-10 19:56:00', true, 4000, 'Kirchenweg 8 Zollikerstr. ZH8', '2602260060045', '37/30 kmh', 37, 30, 'Ionut', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyac167e0de479e6ff7ebe7';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyb51da277f7a316adbe618', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy13ddf17b98cd08ab36e7c';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyb3e0abe4d1dee5e70998e', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-06-13 22:00:00', TIMESTAMP '2026-08-09 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyad00bf9fa71d445cff2b3' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615132'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyb263a23ac21f9005917fd', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Ibo mit ZH 615 132 (7 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy2316c3fc0c50a25a60bd3', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-13 23:44:00', true, 4000, 'Zollikerstr 126 Zürich 8', '2603621060344', '38/30 kmh', 38, 30, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy00db079909b6d41e025d7', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy2316c3fc0c50a25a60bd3';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy32b8eac7988c4d21836d7', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-14 00:34:00', true, 12000, 'Brüttisellen Autobahn', '8400779061322', '72/60 kmh', 72, 60, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 058 648 4340.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy1128b315b457f45243b4e', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy32b8eac7988c4d21836d7';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy050807424fe74810863c4', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-01 08:40:00', true, 10000, 'Carefour Jules Gonin Lausanne', '8077972070036', 'Misachten der Spurwahl', NULL, NULL, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 021 315 3761.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcya7db7bee4fc4d4ea15f80', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy050807424fe74810863c4';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy67a497a2e1d0ed480fce6', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-15 21:53:00', true, 4000, 'Rüternstr. Dietikon', '100060601', '35/30 kmh', 35, 30, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 740 17 77.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy593589aa1bb1681de4700', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy67a497a2e1d0ed480fce6';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyb430e0581a2791aaadd01', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-24 09:13:00', true, 4000, 'Fehraltorferstr.', '57805', '35/30 kmh', 35, 30, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 355 77 30.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy6a14545b5485c955a7fa5', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyb430e0581a2791aaadd01';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcybd559fa6115ba18c47a63', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-27 21:52:00', true, 25000, 'Usterstrasse Dübendorf', '171925', '64/50 kmh', 64, 50, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten).', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyddab3e1f333fb1a6e0579', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcybd559fa6115ba18c47a63';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyd9cfe524a58566e56ca9b', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-09 20:19:00', true, 25000, 'Escherwyssplatz / Hardturm', '2604963070961', 'Rotlicht', NULL, NULL, 'Ibo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyb3e0abe4d1dee5e70998e';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy278ac539048ffdc907da0', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyd9cfe524a58566e56ca9b';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy0b5b3f2cb24cdd2c87417', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-06-29 22:00:00', TIMESTAMP '2026-06-30 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy48f068ad7a4e360b6b281' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615132'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyef8a104d54ed581e114ff', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Laszlo mit ZH 615 132 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy0b5b3f2cb24cdd2c87417';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy1ef506ce35ca912abbe52', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-30 14:10:00', true, 4000, 'Rosengartenstr. 62', '288016210105', NULL, NULL, NULL, 'Laszlo', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten).', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy0b5b3f2cb24cdd2c87417';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyb9ef58aa2e5183cb1e032', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy1ef506ce35ca912abbe52';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy8c102f11c2c12566a4f96', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-05-11 22:00:00', TIMESTAMP '2026-05-16 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyd38e169441861420f6c89' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615166'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyfb8661396538b9d1f8ce9', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Shawky mit ZH 615 166 (2 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy8c102f11c2c12566a4f96';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyd2bc41fe7103619dd29bc', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-11 23:23:00', true, 4000, 'Baden Bruggerstrasse', 'Reg-Nr. 877266', '+4 kmh', NULL, NULL, 'Shawky', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 056 200 76 06.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy8c102f11c2c12566a4f96';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy338d4967cc9cee1dab73c', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyd2bc41fe7103619dd29bc';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy915027f99fc3c73e9bce1', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-15 22:50:00', true, 8000, 'Hohlstr. 550', 'Beppo 226810432', 'Parkzeit übertretung', NULL, NULL, 'Shawky', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 200 15 17.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy8c102f11c2c12566a4f96';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcya2a6b0fd47b1c8e21e42f', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy915027f99fc3c73e9bce1';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy09f18ad7b54101a8d6a6c', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-06-03 22:00:00', TIMESTAMP '2026-06-05 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy010b1291995b95a179c27' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615166'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy589464625f49c246fe47c', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Lazhar mit ZH 615 166 (2 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy09f18ad7b54101a8d6a6c';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyf61c643f6a04ed5533d42', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-04 18:17:00', true, 8500, 'Badenerstr 342 8004 ZH', '101147', 'Parking unberechtigt', NULL, NULL, 'Lazhar', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten).', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy09f18ad7b54101a8d6a6c';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy7b3d789dda8e320aaf6a1', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyf61c643f6a04ed5533d42';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy31478fd20de28e38998f8', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-05 21:07:00', true, 6000, 'Bernerstr N180 8064 Zürich', '1008221', 'Befahren privat Grund', NULL, NULL, 'Lazhar', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 885 3233.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy09f18ad7b54101a8d6a6c';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy61365551138ee5818f28c', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy31478fd20de28e38998f8';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyc282406e2ab15dc9395eb', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-12 22:00:00', TIMESTAMP '2026-07-14 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy887481d1126c5c646acec' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH615166'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy862b21c6c7e2efd5bfd31', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Milan mit ZH 615 166 (3 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyc282406e2ab15dc9395eb';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcye610ee06458e85406b86c', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-12 23:26:00', true, 6000, 'Wangen Brüttisellen Autobahn', '8400789061123', '71/60 kmh', 71, 60, 'Milan', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 058 648 43 40.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyc282406e2ab15dc9395eb';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyc2049ec1ece66651f7890', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcye610ee06458e85406b86c';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy56c4d55525ac29b94ee11', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-14 12:25:00', true, 12000, 'Birmensdorferstr. 660', '2604659060011', '60/50 kmh', 60, 50, 'Milan', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyc282406e2ab15dc9395eb';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyca3c7a20b68ed9909d026', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy56c4d55525ac29b94ee11';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy8c48cf011f9000ac0f023', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-14 21:20:00', true, 4000, 'Steinstrasse 63 Zürich 3', '2604364061225', '35/30 kmh', 35, 30, 'Milan', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyc282406e2ab15dc9395eb';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy63d4291b83d43d57f2c75', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy8c48cf011f9000ac0f023';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy12ecd336eaa7c3a599d67', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-06-10 22:00:00', TIMESTAMP '2026-06-11 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyca3ae1ccd5a4d63790eb8' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH886530'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy6adb3df89b1cc0d9dc5ae', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Antonios mit ZH 886 530 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy12ecd336eaa7c3a599d67';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcybfcdf75338aadee051177', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-06-11 14:21:00', true, 4000, '5453 Remetschwil Landstr', '220469', '58/50 kmh', 58, 50, 'Antonios', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 056 485 71 00.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy12ecd336eaa7c3a599d67';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyce770750ad5a322006d81', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcybfcdf75338aadee051177';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcy5636604da72745d9b1252', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-09-02 22:00:00', TIMESTAMP '2026-09-03 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy6b9491a45d2c80be80edc' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH886530'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy812d75cd94ecdf852b369', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Kante mit ZH 886 530 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcy5636604da72745d9b1252';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy255762cb0090753a3d4af', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-09-03 17:43:00', true, 7000, 'Europastr. 3 8152 Glattbrugg', '104473', 'Wrong Parking', NULL, NULL, 'Kante', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 437 37 94.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcy5636604da72745d9b1252';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcyf05fd3724198835e9983d', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy255762cb0090753a3d4af';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyc8b22db85b38e06c289d0', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-10 22:00:00', TIMESTAMP '2026-07-11 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy6e1c590d4d3e7d7fec153' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH918474'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcybb55b993f0067bfc46c53', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von DZONIC, Sinisa mit ZH 918 474 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyc8b22db85b38e06c289d0';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyfead51812fdd7eb4b1e68', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-11 01:26:00', true, 12000, 'Volketswil Autobahn', '8400791060529', '98/80 kmh', 98, 80, 'DZONIC, Sinisa', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 058 648 43 40.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyc8b22db85b38e06c289d0';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy5127ecc37e8807b13a7bf', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyfead51812fdd7eb4b1e68';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyaaa6da0b5aa6cc446af95', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-28 22:00:00', TIMESTAMP '2026-08-30 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy43a570800a1900741c045' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH918474'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy2baf70c48a456e1127e49', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Hazem mit ZH 918 474 (3 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyaaa6da0b5aa6cc446af95';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcyac034de925fe8a3225476', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-29 11:45:00', true, 4000, 'Jona Zürcherstrasse', '6600343065251', '58/50 kmh', 58, 50, 'Hazem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 058 229 34 34.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyaaa6da0b5aa6cc446af95';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy2a7cdc351e756b8a11641', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcyac034de925fe8a3225476';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy66f01631817f1fd873f73', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-15 10:54:00', true, 10000, 'Uetlibergstrasse', '18166', 'Fahrverbot', NULL, NULL, 'Hazem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 200 15 17.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyaaa6da0b5aa6cc446af95';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy1c6ab53e5a48dba522284', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy66f01631817f1fd873f73';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy46604a3558c08d8d9135d', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-08-30 11:15:00', true, 10000, 'Uetliberg shule', '18440', 'Fahrverbot', NULL, NULL, 'Hazem', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 200 15 17.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyaaa6da0b5aa6cc446af95';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy4c0ccdcf916303ee345f2', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy46604a3558c08d8d9135d';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyaa14f2690f0a4211dcdd7', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-05-26 22:00:00', TIMESTAMP '2026-05-27 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcyb2662b36708c9d0de14d9' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH919906'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcy465e3166e93c7715a6ac3', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Krazimir mit ZH 919 906 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyaa14f2690f0a4211dcdd7';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy4b8afb147652b6e92613b', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-05-26 23:59:00', true, 4000, 'Sihlquai Wipkingerbrücke', '2603266070678', '37/30 kmh', 37, 30, 'Krazimir', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyaa14f2690f0a4211dcdd7';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy20470e0f05d5667b1b3fe', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy4b8afb147652b6e92613b';

INSERT INTO "Rental" ("id", "organisationId", "carId", "customerId", "createdBy", "type", "status", "startAt", "endAt", "currency", "depositCents")
SELECT 'lgcyf00e215cca7e6f6fc4989', c."organisationId", c."id", cu."id", 'import:fines-list', 'FIXED_TERM'::"RentalType", 'COMPLETED'::"RentalStatus", TIMESTAMP '2026-07-14 22:00:00', TIMESTAMP '2026-07-15 21:59:00', 'chf', 0
FROM "Car" c JOIN "Customer" cu ON cu."id" = 'lgcy87d5504a2fb5a8373bf70' AND cu."organisationId" = c."organisationId"
WHERE upper(regexp_replace(c."plate", '[^A-Za-z0-9]', '', 'g')) = 'ZH919906'
ORDER BY (c."status" = 'retired'), c."id" LIMIT 1;
INSERT INTO "RentalEvent" ("id", "rentalId", "type", "payload")
SELECT 'lgcyd28196b77c21ba085c2d1', r."id", 'import.fines-list', jsonb_build_object('reason', 'Zeitraum aus der Bussenliste rekonstruiert: erste bis letzte Busse von Teddy mit ZH 919 906 (1 Bussen). Kein Vertrag; Daten bei Bedarf im Verlauf korrigieren.', 'source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Rental" r WHERE r."id" = 'lgcyf00e215cca7e6f6fc4989';
INSERT INTO "Fine" ("id", "organisationId", "carId", "rentalId", "customerId", "status", "violationAt", "violationTimeKnown", "amountCents", "location", "fineNumber", "offenceTextDe", "speedMeasuredKmh", "speedLimitKmh", "legacyDriverName", "legacySource", "closedNote", "updatedAt")
SELECT 'lgcy4010057d695b0dde259de', r."organisationId", r."carId", r."id", r."customerId", 'HANDLED_OTHERWISE'::"FineStatus", TIMESTAMP '2026-07-15 19:55:00', true, 4000, 'Kaiserstuhlstr. Oberglatt', '8205323060121', '55/50 kmh', 55, 50, 'Teddy', 'list:Bussenliste vor dem System (Papiermieten)', 'Aus der Bussenliste vor dem System (Papiermieten). Kontakt laut Liste: 044 411 76 76.', NOW()
FROM "Rental" r WHERE r."id" = 'lgcyf00e215cca7e6f6fc4989';
INSERT INTO "FineEvent" ("id", "fineId", "type", "payload")
SELECT 'lgcy24df05f1f1ffee153689a', f."id", 'fine.legacy-imported', jsonb_build_object('source', 'list:Bussenliste vor dem System (Papiermieten)')
FROM "Fine" f WHERE f."id" = 'lgcy4010057d695b0dde259de';

