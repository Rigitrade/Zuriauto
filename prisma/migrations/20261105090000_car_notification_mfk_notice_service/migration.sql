-- The two-week MFK notice to the office and the renter, and the oil-service
-- reminders (owner, 05.11.2026). Additive: existing rows keep MFK_DUE.
ALTER TYPE "CarNotificationKind" ADD VALUE 'MFK_NOTICE';
ALTER TYPE "CarNotificationKind" ADD VALUE 'SERVICE_DUE';
ALTER TYPE "CarNotificationKind" ADD VALUE 'SERVICE_OVERDUE';
