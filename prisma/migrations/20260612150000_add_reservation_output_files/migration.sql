ALTER TABLE "PageReservation"
ADD COLUMN "outputOriginalName" TEXT,
ADD COLUMN "outputStoredName" TEXT,
ADD COLUMN "outputMimeType" TEXT,
ADD COLUMN "outputFileSize" INTEGER;

CREATE UNIQUE INDEX "PageReservation_outputStoredName_key"
ON "PageReservation"("outputStoredName");
