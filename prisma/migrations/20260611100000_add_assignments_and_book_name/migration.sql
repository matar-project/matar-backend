ALTER TABLE "Request" ADD COLUMN "bookName" TEXT;

CREATE TABLE "RequestVolunteerAssignment" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "volunteerId" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestVolunteerAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityParticipation" (
    "id" SERIAL NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "volunteerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityParticipation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequestVolunteerAssignment_requestId_key"
ON "RequestVolunteerAssignment"("requestId");
CREATE INDEX "RequestVolunteerAssignment_volunteerId_idx"
ON "RequestVolunteerAssignment"("volunteerId");
CREATE INDEX "RequestVolunteerAssignment_status_idx"
ON "RequestVolunteerAssignment"("status");
CREATE UNIQUE INDEX "OpportunityParticipation_opportunityId_volunteerId_key"
ON "OpportunityParticipation"("opportunityId", "volunteerId");
CREATE INDEX "OpportunityParticipation_volunteerId_idx"
ON "OpportunityParticipation"("volunteerId");

ALTER TABLE "RequestVolunteerAssignment"
ADD CONSTRAINT "RequestVolunteerAssignment_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestVolunteerAssignment"
ADD CONSTRAINT "RequestVolunteerAssignment_volunteerId_fkey"
FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpportunityParticipation"
ADD CONSTRAINT "OpportunityParticipation_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityParticipation"
ADD CONSTRAINT "OpportunityParticipation_volunteerId_fkey"
FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
