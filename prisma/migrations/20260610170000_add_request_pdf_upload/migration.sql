ALTER TABLE "Request"
ADD COLUMN "pdfOriginalName" TEXT,
ADD COLUMN "pdfStoredName" TEXT,
ADD COLUMN "pdfMimeType" TEXT,
ADD COLUMN "pdfFileSize" INTEGER;

CREATE UNIQUE INDEX "Request_pdfStoredName_key" ON "Request"("pdfStoredName");
