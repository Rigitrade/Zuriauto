-- Multi-company phase D (16.11.2026): ZURIAUTO can switch a partner company
-- off. Additive and nullable: a no-op for every existing company.
ALTER TABLE "Organisation" ADD COLUMN "disabledAt" TIMESTAMP(3);
