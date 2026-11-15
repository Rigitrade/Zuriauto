-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "officeEmail" TEXT,
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "signingPlace" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "twintUrl" TEXT,
ADD COLUMN     "uid" TEXT,
ADD COLUMN     "website" TEXT;

-- ZURIAUTO's identity as its documents printed it before phase B, so the
-- settings page shows real values. A no-op on an empty database. The office
-- address stays NULL: ZURIAUTO's office mails keep going to MAIL_OFFICE.
UPDATE "Organisation" SET
  "brandName" = 'ZURIAUTO',
  "legalName" = 'Rigitrade AG',
  "street" = 'Schaffhauserstrasse 550',
  "postalCode" = '8052',
  "city" = 'Zürich',
  "uid" = 'CHE-199.884.159',
  "phone" = '+41 58 513 99 96',
  "signerName" = 'Katamesh, Ahmed',
  "website" = 'zuriauto.ch',
  "signingPlace" = 'Zurich',
  "paymentUrl" = 'https://pay.sumup.com/b2c/QH47IRGK',
  "twintUrl" = 'https://go.twint.ch/1/e/tw?tw=acq.lf42UVlQQmWchQ9Tc9F26Jz5NoLlBomH_GHXKQtNDVX2QFYuD_n6mKCpYAihzGcx'
WHERE "slug" = 'zuriauto';
