CREATE TYPE "AccountStatus" AS ENUM (
  'EMAIL_VERIFICATION_PENDING',
  'PENDING_ADMIN_REVIEW',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "VerificationDocumentStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "User"
ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailVerificationCodeHash" TEXT,
ADD COLUMN "emailVerificationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3);

CREATE TABLE "VerificationDocument" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "status" "VerificationDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByAdminId" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "VerificationDocument_userId_status_idx" ON "VerificationDocument"("userId", "status");
CREATE INDEX "VerificationDocument_status_createdAt_idx" ON "VerificationDocument"("status", "createdAt");

ALTER TABLE "VerificationDocument"
ADD CONSTRAINT "VerificationDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationDocument"
ADD CONSTRAINT "VerificationDocument_reviewedByAdminId_fkey"
FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
