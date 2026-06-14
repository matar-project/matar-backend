ALTER TYPE "VerificationDocumentStatus"
RENAME TO "VerificationDocumentStatus_old";

CREATE TYPE "VerificationDocumentStatus" AS ENUM (
  'AWAITING_EMAIL_VERIFICATION',
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "VerificationDocument"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "VerificationDocumentStatus"
USING ("status"::text::"VerificationDocumentStatus"),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "VerificationDocumentStatus_old";

UPDATE "VerificationDocument" AS document
SET "status" = 'AWAITING_EMAIL_VERIFICATION'::"VerificationDocumentStatus"
FROM "User" AS account
WHERE document."userId" = account."id"
  AND document."status" = 'PENDING'::"VerificationDocumentStatus"
  AND account."emailVerified" = false;
