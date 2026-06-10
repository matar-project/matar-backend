ALTER TYPE "RequestType" RENAME TO "RequestType_old";
CREATE TYPE "RequestType" AS ENUM (
    'PDF_TO_WORD',
    'PDF_TO_AUDIO',
    'ACCOMPANIMENT'
);
ALTER TABLE "Request"
ALTER COLUMN "requestType" TYPE "RequestType"
USING ("requestType"::text::"RequestType");
DROP TYPE "RequestType_old";

ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
CREATE TYPE "RequestStatus" AS ENUM (
    'PENDING_COORDINATOR',
    'COORDINATOR_ACCEPTED',
    'COORDINATOR_REJECTED',
    'DONE'
);
ALTER TABLE "Request"
ALTER COLUMN "status" TYPE "RequestStatus"
USING ("status"::text::"RequestStatus");
ALTER TABLE "Request"
ALTER COLUMN "status" SET DEFAULT 'PENDING_COORDINATOR';
DROP TYPE "RequestStatus_old";
