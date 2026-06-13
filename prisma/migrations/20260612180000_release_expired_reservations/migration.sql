ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "PageReservation"
DROP CONSTRAINT IF EXISTS "PageReservation_no_overlap";

ALTER TABLE "PageReservation"
ADD CONSTRAINT "PageReservation_no_overlap"
EXCLUDE USING gist (
  "requestId" WITH =,
  int4range("startPage", "endPage", '[]') WITH &&
)
WHERE ("status" IN ('IN_PROGRESS', 'DONE'));
