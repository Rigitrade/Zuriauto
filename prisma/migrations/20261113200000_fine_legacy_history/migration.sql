-- Fines from the list kept before the system: closed history with the driver as the list names them.
ALTER TABLE "Fine" ADD COLUMN "legacyDriverName" TEXT,
ADD COLUMN "legacySource" TEXT;
