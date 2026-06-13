UPDATE "PageReservation"
SET "status" = 'EXPIRED'
WHERE "status" = 'IN_PROGRESS'
  AND "deadlineAt" < NOW();
