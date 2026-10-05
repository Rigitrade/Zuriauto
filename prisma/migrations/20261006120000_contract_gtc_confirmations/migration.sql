-- When the renter ticked each GTC Art. 11 box (GTC of 06.10.2026). Nullable:
-- contracts signed earlier, and return addenda, never asked.
ALTER TABLE "Contract" ADD COLUMN     "deceptionNoticeConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "truthfulInfoConfirmedAt" TIMESTAMP(3);
