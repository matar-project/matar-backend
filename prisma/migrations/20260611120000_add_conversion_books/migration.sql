CREATE TABLE "ConversionBook" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "wordCompleted" BOOLEAN NOT NULL DEFAULT false,
    "audioCompleted" BOOLEAN NOT NULL DEFAULT false,
    "wordCompletedAt" TIMESTAMP(3),
    "audioCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversionBook_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Request" ADD COLUMN "conversionBookId" INTEGER;

CREATE UNIQUE INDEX "ConversionBook_normalizedName_key"
ON "ConversionBook"("normalizedName");
CREATE INDEX "ConversionBook_wordCompleted_idx"
ON "ConversionBook"("wordCompleted");
CREATE INDEX "ConversionBook_audioCompleted_idx"
ON "ConversionBook"("audioCompleted");
CREATE INDEX "Request_conversionBookId_idx"
ON "Request"("conversionBookId");

ALTER TABLE "Request"
ADD CONSTRAINT "Request_conversionBookId_fkey"
FOREIGN KEY ("conversionBookId") REFERENCES "ConversionBook"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
