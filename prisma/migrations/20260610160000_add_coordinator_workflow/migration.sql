-- Extend the existing enums so legacy request records remain valid.
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'PDF_TO_WORD';
ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'PDF_TO_AUDIO';

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_COORDINATOR';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'COORDINATOR_ACCEPTED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'COORDINATOR_REJECTED';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'DONE';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "ReservationStatus" AS ENUM ('IN_PROGRESS', 'DONE', 'REJECTED', 'LATE');

ALTER TABLE "Request"
ADD COLUMN "createdByUserId" INTEGER,
ADD COLUMN "title" TEXT,
ADD COLUMN "pdfFileUrl" TEXT,
ADD COLUMN "totalPages" INTEGER,
ADD COLUMN "coordinatorId" INTEGER,
ADD COLUMN "coordinatorNotes" TEXT;

CREATE TABLE "PageReservation" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "volunteerId" INTEGER NOT NULL,
    "startPage" INTEGER NOT NULL,
    "endPage" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PageReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PageReservation_page_range_check" CHECK ("startPage" >= 1 AND "endPage" >= "startPage")
);

CREATE INDEX "Request_createdByUserId_idx" ON "Request"("createdByUserId");
CREATE INDEX "Request_coordinatorId_idx" ON "Request"("coordinatorId");
CREATE INDEX "Request_status_idx" ON "Request"("status");
CREATE INDEX "PageReservation_requestId_idx" ON "PageReservation"("requestId");
CREATE INDEX "PageReservation_volunteerId_idx" ON "PageReservation"("volunteerId");
CREATE INDEX "PageReservation_status_idx" ON "PageReservation"("status");

ALTER TABLE "Request"
ADD CONSTRAINT "Request_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
ADD CONSTRAINT "Request_coordinatorId_fkey"
FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PageReservation"
ADD CONSTRAINT "PageReservation_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageReservation"
ADD CONSTRAINT "PageReservation_volunteerId_fkey"
FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent race conditions where two volunteers reserve overlapping ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "PageReservation"
ADD CONSTRAINT "PageReservation_no_overlap"
EXCLUDE USING gist (
  "requestId" WITH =,
  int4range("startPage", "endPage", '[]') WITH &&
)
WHERE ("status" <> 'REJECTED');
